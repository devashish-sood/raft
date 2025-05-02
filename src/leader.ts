import { Constants } from "./util/constants";
import { Candidate, Command, Follower, Leader, Replica } from "./util/types";
import { isBusinessMsg, isProtoMsg, toFollower } from "./follower";
import {
  AppendEntriesMessage,
  AppendResponseMessage,
  BusinessMessage,
  GetRequestMessage,
  GetSuccessMessage,
  ProtoMessage,
  PutSuccessMessage,
} from "./util/message-schemas";
import { sendFail, sendMessage } from "./send";

function toLeader(candidate: Candidate): Leader {
  const leader = {
    ...candidate,
    role: Constants.LEADER,
    leader: candidate.config.id,
    nextIndex: Object.fromEntries(
      [candidate.config.id, ...candidate.config.others].map((rep) => [
        rep,
        candidate.log.length - 1,
      ]),
    ),
    matchIndex: Object.fromEntries(
      [candidate.config.id, ...candidate.config.others].map((rep) => [
        rep,
        rep === candidate.config.id ? candidate.log.length - 1 : 0,
      ]),
    ),
    lastAE: new Date(),
  };
  updateCommitIdx(leader);
  return leader;
}

function constructHeartbeat(leader: Leader): AppendEntriesMessage {
  const lastLogIndex = leader.log.length - 1;
  return {
    src: leader.config.id,
    dst: Constants.BROADCAST,
    type: Constants.APPENDENTRIES,
    term: leader.term,
    leader: leader.config.id,
    plogIdx: lastLogIndex,
    plogTerm: lastLogIndex >= 0 ? leader.log[lastLogIndex].term : 0,
    entries: [],
    lCommit: leader.commitIndex,
  };
}

function applyCommand(replica: Replica, cmd: Command) {
  replica.store[cmd.key] = cmd.val;
}

async function applyCommits(
  replica: Replica,
  clientCallback: (cmd: Command) => Promise<void> = async (cmd) => {},
) {
  if (replica.commitIndex < 0) {
    return;
  }
  while (replica.lastApplied <= replica.commitIndex) {
    const cmd = replica.log[replica.lastApplied];
    applyCommand(replica, cmd);
    await clientCallback(cmd);
    replica.lastApplied += 1;
  }
}

async function runLeader(leader: Leader): Promise<Follower> {
  const hbTimeout = (leader.electionTimeout * 3) / 5;
  await sendMessage(leader, constructHeartbeat(leader));
  const heartbeatInterval = setInterval(async () => {
    if (Date.now() - leader.lastAE.getTime() >= hbTimeout) {
      await sendMessage(leader, constructHeartbeat(leader));
    }

    // applyCommits(leader, async (cmd) => {
    //   await sendMessage(leader, createPutSuccessMessage(leader, cmd));
    // });
  }, hbTimeout);

  return new Promise<Follower>((resolve, _) => {
    const msgHandler = (msg: Buffer) => {
      //callback for cleaning up listener/interval on replica state change
      const cleanupAndResolve = (val: Follower) => {
        clearInterval(heartbeatInterval);
        leader.config.socket.off("message", msgHandler);
        resolve(val);
      };

      //actual message handler
      const parsedMessage = JSON.parse(msg.toString("utf-8"));
      if (isBusinessMsg(parsedMessage)) {
        handleClientMessage(leader, parsedMessage);
      } else if (isProtoMsg(parsedMessage)) {
        handleProtoMessage(leader, parsedMessage, cleanupAndResolve);
      }
    };

    leader.config.socket.on("message", msgHandler);
  });
}

function createAEMsg(
  leader: Leader,
  plogIdx: number,
  cmd: Command,
): AppendEntriesMessage {
  return {
    src: leader.config.id,
    dst: Constants.BROADCAST,
    leader: leader.config.id,
    type: Constants.APPENDENTRIES,
    term: leader.term,
    plogIdx: plogIdx,
    plogTerm: plogIdx >= 0 ? leader.log[plogIdx].term : 0,
    lCommit: leader.commitIndex,
    entries: [cmd],
  };
}

function createGetSuccessMsg(
  leader: Leader,
  msg: GetRequestMessage,
  value: string,
): GetSuccessMessage {
  return {
    src: leader.config.id,
    dst: msg.src,
    type: Constants.OK,
    leader: leader.leader,
    value,
    MID: msg.MID,
  };
}

function createPutSuccessMessage(
  leader: Leader,
  cmd: Command,
): PutSuccessMessage {
  return {
    src: leader.config.id,
    dst: cmd.src,
    type: Constants.OK,
    leader: leader.config.id,
    MID: cmd.MID,
  };
}

async function handleClientMessage(leader: Leader, msg: BusinessMessage) {
  switch (msg.type) {
    case Constants.GET:
      await sendMessage(
        leader,
        createGetSuccessMsg(leader, msg, leader.store[msg.key] ?? ""),
      );
      break;
    case Constants.PUT:
      try {
        const cmdLogIndex = leader.log.length - 1;
        const putCommand = {
          src: msg.src,
          key: msg.key,
          val: msg.value,
          MID: msg.MID,
          term: leader.term,
        };
        leader.log.push(putCommand);
        leader.matchIndex[leader.config.id] = cmdLogIndex + 1;
        updateCommitIdx(leader);
        await sendMessage(leader, createAEMsg(leader, cmdLogIndex, putCommand));
        leader.lastAE = new Date();
      } catch (e) {
        sendFail(leader, msg);
      }
      break;
    default:
      console.log("Unexpected message received", msg.type, msg);
  }
}

async function updateCommitIdx(leader: Leader) {
  if (leader.log.length == 0) {
    return;
  }
  const sortedCommits = Object.values(leader.matchIndex).sort((a, b) => b - a);
  const medianIdx = Math.floor(sortedCommits.length / 2);
  leader.commitIndex = Math.max(sortedCommits[medianIdx], leader.commitIndex);
  await applyCommits(leader, async (cmd) => {
    await sendMessage(leader, createPutSuccessMessage(leader, cmd));
  });
}

function handleAppendResponse(leader: Leader, msg: AppendResponseMessage) {
  if (msg.success) {
    leader.matchIndex[msg.src] = Math.max(
      leader.matchIndex[msg.src] ?? 0,
      msg.idx,
    );
    updateCommitIdx(leader);
  } else {
    leader.nextIndex[msg.src] = msg.idx;
    retryAppend(leader, msg.src);
  }
}

async function retryAppend(leader: Leader, dst: string) {
  const ae: AppendEntriesMessage = {
    src: leader.config.id,
    dst: dst,
    type: Constants.APPENDENTRIES,
    term: leader.term,
    leader: leader.config.id,
    plogIdx: leader.nextIndex[dst],
    plogTerm: leader.log[leader.nextIndex[dst]]?.term ?? 0,
    entries: leader.log.slice(leader.nextIndex[dst] + 1),
    lCommit: leader.commitIndex,
  };
  await sendMessage(leader, ae);
}

function handleProtoMessage(
  leader: Leader,
  msg: ProtoMessage,
  resolve: (value: Follower) => void,
) {
  switch (msg.type) {
    //TODO: term check and follower resolve, when moved outside of the switch cases, was creating problems at some point. test and fix this later
    case Constants.APPENDENTRIES:
      if (msg.term > leader.term) {
        resolve(toFollower(leader, msg.term));
        return;
      }
      break;
    case Constants.APPENDRESPONSE:
      if (msg.term > leader.term) {
        resolve(toFollower(leader, msg.term));
        return;
      }
      handleAppendResponse(leader, msg);
      break;
    case Constants.VOTEREQUEST:
      if (msg.term > leader.term) {
        resolve(toFollower(leader, msg.term));
        return;
      }
      break;
    case Constants.VOTERESPONSE:
      break;
  }
}

export { toLeader, runLeader, applyCommits };
