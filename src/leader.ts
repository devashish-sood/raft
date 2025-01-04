import { config } from "process";
import { Constants } from "./util/constants";
import { Candidate, Follower, Leader } from "./util/types";
import { isBusinessMsg, isProtoMsg } from "./follower";
import { ClientMessage } from "./util/message-schemas";
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

async function runLeader(leader: Leader): Promise<Follower> {
  // send initial heartbeat
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

function handleClientMessage(leader: Leader, msg: ClientMessage) {
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
        leader.log.push({ key: msg.key, value: msg.value, MID: msg.MID });
        leader.store[msg.key] = msg.value;
        sendPutSuccess(leader, msg) 
      } catch (e) {
        sendFail(leader, msg)
      }
  }
}

export { toLeader, runLeader};
