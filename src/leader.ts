import { Constants } from "./util/constants";
import { Candidate, Command, Follower, Leader } from "./util/types";
import { isBusinessMsg, isProtoMsg, toFollower } from "./follower";
import {
  AppendEntriesMessage,
  GetRequestMessage,
  PutRequestMessage,
} from "./util/message-schemas";
import { sendFail, sendMessage } from "./send";

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

function createAAMsg(
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
  };
}

function handleClientMessage(
  leader: Leader,
  msg: GetRequestMessage | PutRequestMessage,
) {
  switch (msg.type) {
    case Constants.GET:
      if (leader.store[msg.key]) {
        sendGetSuccess(leader, msg);
      } else {
        sendFail(leader, msg);
      }
      break;
    case Constants.PUT:
      try {
        const putCommand = {
          key: msg.key,
          val: msg.value,
          MID: msg.MID,
          term: leader.currentTerm,
          voteCount: 0,
        };
        leader.logBuffer[putCommand.MID] = putCommand;
        const cmdLogIndex = leader.log.length - 1;
        leader.log.push(putCommand);
        sendMessage(leader, createAAMsg(leader, cmdLogIndex, putCommand));
        // leader shouldn't have to wait until majority acknowledgement comes through.
        // Makes sense to use a buffer of pending commits, and keep updating them as I get acks from the followers
        // When a commit meets majority requirement, I can apply it.
      } catch (e) {
        sendFail(leader, msg);
      }
  }
}

function sendGetSuccess(leader: Leader, msg: GetRequestMessage) {}

function sendPutSuccess(leader: Leader, msg: PutRequestMessage) {}

function handleProtoMessage(
  leader: Leader,
  parsedMessage: any,
  resolve: (value: Follower) => void,
) {
  throw new Error("Function not implemented.");
}

export { toLeader, runLeader };
