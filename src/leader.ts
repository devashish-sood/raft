import { Constants } from "./util/constants";
import { Candidate, Follower, Leader } from "./util/types";
import { isBusinessMsg, isProtoMsg } from "./follower";
import {
  AppendEntriesMessage,
  GetRequestMessage,
  PutRequestMessage,
} from "./util/message-schemas";
import { sendFail } from "./send";

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
  // add an interval executor that checks if 100 ms have passed since last message (last AA), and then send an empty heartbeat
  return new Promise<Follower>((resolve, _) => {
    listenForMessages(leader, resolve);
  });
}

function listenForMessages(leader: Leader, resolve: (value: Follower) => void) {
  leader.config.socket.on("message", (msg) => {
    const parsedMessage = JSON.parse(msg.toString("utf-8"));
    if (isBusinessMsg(parsedMessage)) {
      handleClientMessage(leader, parsedMessage);
    } else if (isProtoMsg(parsedMessage)) {
      handleProtoMessage(leader, parsedMessage, resolve);
    }
  });
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
        leader.log.push({
          key: msg.key,
          val: msg.value,
          MID: msg.MID,
          term: leader.currentTerm,
        });
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
