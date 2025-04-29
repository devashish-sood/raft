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
import { assert } from "console";
import { AssertionError } from "assert";

function toLeader(candidate: Candidate): Leader {
  return {
    ...candidate,
    role: Constants.LEADER,
    leader: candidate.config.id,
    nextIndex: {},
    matchIndex: {},
  };
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

function applyCommits(
  replica: Replica,
  clientCallback: (cmd: Command) => void = () => {},
) {
  while (replica.lastApplied < replica.commitIndex) {
    replica.lastApplied += 1;
    const cmd = replica.log[replica.lastApplied];
    applyCommand(replica, cmd);
    clientCallback(cmd);
  }
}

async function runLeader(leader: Leader): Promise<Follower> {
  const hbTimeout = (leader.electionTimeout * 4) / 5;
  sendMessage(leader, constructHeartbeat(leader));
  const heartbeatInterval = setInterval(() => {
    if (Date.now() - leader.lastAE.getTime() >= hbTimeout) {
      sendMessage(leader, constructHeartbeat(leader));
    }

    applyCommits(leader, (cmd) => {
      sendMessage(leader, createPutSuccessMessage(leader, cmd));
    });
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

function handleClientMessage(leader: Leader, msg: BusinessMessage) {
  switch (msg.type) {
    case Constants.GET:
      if (leader.store[msg.key]) {
        sendMessage(
          leader,
          createGetSuccessMsg(leader, msg, leader.store[msg.key]),
        );
      } else {
        sendFail(leader, msg);
      }
      break;
    case Constants.PUT:
      try {
        const cmdLogIndex = leader.log.length - 1;
        const putCommand = {
          src: msg.src,
          id: cmdLogIndex + 1,
          key: msg.key,
          val: msg.value,
          MID: msg.MID,
          term: leader.term,
          acks: [],
          acked: false,
        };
        // pre-calculate llogidx for messages just to prevent race conditions
        leader.log.push(putCommand);
        sendMessage(leader, createAEMsg(leader, cmdLogIndex, putCommand));
        leader.lastAE = new Date();
      } catch (e) {
        sendFail(leader, msg);
      }
      break;
    default:
      console.log("Unexpected message received", msg.type, msg);
  }
}

function updateCommitIdx(leader: Leader) {
  if (leader.log.length == 0) {
    return;
  }
  const sortedCommits = Object.values(leader.matchIndex).sort((a, b) => b - a);
  const medianIdx = Math.floor(sortedCommits.length / 2);
  leader.commitIndex = sortedCommits[medianIdx];
}

function handleAppendResponse(leader: Leader, msg: AppendResponseMessage) {
  if (msg.success) {
    leader.matchIndex[msg.src] = Math.max(
      leader.matchIndex[msg.src] || 0,
      msg.idx,
    );
    updateCommitIdx(leader);
  } else {
    leader.nextIndex[msg.src] = msg.idx;
  }
}

function handleProtoMessage(
  leader: Leader,
  msg: ProtoMessage,
  resolve: (value: Follower) => void,
) {
  switch (msg.type) {
    case Constants.APPENDENTRIES:
      if (msg.term > leader.term) {
        resolve(toFollower(leader, msg.term));
      }
      break;
    case Constants.APPENDRESPONSE:
      handleAppendResponse(leader, msg);
      break;
    case Constants.VOTEREQUEST:
      break;
    case Constants.VOTERESPONSE:
      break;
  }
}

export { toLeader, runLeader };
