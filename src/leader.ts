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
  PutRequestMessage,
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
    term: leader.currentTerm,
    leader: leader.config.id,
    plogIdx: lastLogIndex,
    plogTerm: lastLogIndex >= 0 ? leader.log[lastLogIndex].term : 0,
    entries: [],
    lCommit: leader.commitIndex,
    MID: "heartbeat",
  };
}

async function runLeader(leader: Leader): Promise<Follower> {
  const heartbeatInterval = setInterval(
    () => sendMessage(leader, constructHeartbeat(leader)),
    (leader.electionTimeout * 4) / 5,
  );

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
  lLogIdx: number,
  cmd: Command,
): AppendEntriesMessage {
  return {
    src: leader.config.id,
    dst: Constants.BROADCAST,
    leader: leader.config.id,
    type: Constants.APPENDENTRIES,
    term: leader.currentTerm,
    plogIdx: lLogIdx,
    plogTerm: lLogIdx >= 0 ? leader.log[lLogIdx].term : 0,
    lCommit: leader.commitIndex,
    entries: [cmd],
    MID: cmd.MID,
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
          id: cmdLogIndex + 1,
          key: msg.key,
          val: msg.value,
          MID: msg.MID,
          term: leader.currentTerm,
          acks: [leader.config.id], // CHECK: account for self?
        };
        // pre-calculate llogidx for messages just to prevent race conditions
        leader.log.push(putCommand);
        sendMessage(leader, createAEMsg(leader, cmdLogIndex, putCommand));
      } catch (e) {
        sendFail(leader, msg);
      }
    default:
      console.log("Unexpected message received", msg.type, msg);
  }
}

function handleAppendResponse(leader: Leader, msg: AppendResponseMessage) {
  const cmd = leader.log[msg.logIdx]; // the command at the log in the response message
  try {
    assert(cmd !== undefined);
    assert(cmd.MID == msg.MID);

    if (!cmd.acks.includes(msg.src)) {
      cmd.acks.push(msg.src);
    }
  } catch (e: unknown) {
    if (e instanceof AssertionError) {
      console.log("mismatch between leader log and follower append response.");
      console.log("Leader log at that position:", cmd);
      console.log("Follower append response:", msg);
    } else {
      throw e;
    }
  }
}

function handleProtoMessage(
  leader: Leader,
  msg: ProtoMessage,
  resolve: (value: Follower) => void,
) {
  switch (msg.type) {
    case Constants.APPENDENTRIES:
      if (msg.term > leader.currentTerm) {
        toFollower(leader, msg.term);
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
