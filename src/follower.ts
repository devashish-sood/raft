import { sendFail, sendMessage } from "./send";
import { Constants } from "./util/constants";
import { Candidate, Command, Follower, Leader, Replica } from "./util/types";
import {
  AppendEntriesMessage,
  AppendResponseMessage,
  GetRequestMessage,
  Message,
  ProtoMessage,
  PutRequestMessage,
  VoteRequestMessage,
  VoteResponseMessage,
} from "./util/message-schemas";
import { setInterval, clearInterval } from "timers";
import { toCandidate } from "./candidate";

function toFollower(replica: Candidate | Leader, newTerm: number): Follower {
  return {
    ...replica,
    role: Constants.FOLLOWER,
    term: newTerm,
    votedFor: undefined,
    leader: undefined,
  };
}

function constructMsgHandler(follower: Follower) {
  return (msg: Buffer) => {
    console.log(`received:`, msg.toString("utf-8"));
    const parsedMessage = JSON.parse(msg.toString("utf-8"));
    if (isBusinessMsg(parsedMessage)) {
      handleClientMessage(follower, parsedMessage);
    } else if (isProtoMsg(parsedMessage)) {
      handleProtoMsg(follower, parsedMessage);
    }
  };
}

/**
 * Sets up replica storage, starts listening for incoming messages, and sends startup message,
 * @param config the `Replica` config
 */
async function runFollower(follower: Follower): Promise<Candidate> {
  sendStartupMessage(follower);
  const msgHandler = constructMsgHandler(follower);
  follower.config.socket.on("message", msgHandler);
  return checkPulse(follower).then<Candidate>(() => {
    follower.config.socket.off("message", msgHandler);
    return toCandidate(follower);
  });
}

function isBusinessMsg(msg: Message<any>): boolean {
  return [Constants.GET, Constants.PUT].includes(msg.type);
}

function isProtoMsg(msg: Message<any>): boolean {
  return [
    Constants.APPENDENTRIES,
    Constants.APPENDRESPONSE,
    Constants.VOTEREQUEST,
    Constants.VOTERESPONSE,
  ].includes(msg.type);
}

function handleClientMessage(
  replica: Follower | Candidate,
  msg: GetRequestMessage | PutRequestMessage,
) {
  replica.leader ? sendRedirect(replica, msg) : sendFail(replica, msg);
}

function sendRedirect(
  replica: Candidate | Follower,
  msg: GetRequestMessage | PutRequestMessage,
) {
  sendMessage(replica, {
    src: replica.config.id,
    dst: msg.src,
    leader: replica.leader,
    type: Constants.REDIRECT,
    MID: msg.MID,
  });
}

function handleProtoMsg(follower: Follower, msg: ProtoMessage) {
  switch (msg.type) {
    case Constants.APPENDENTRIES:
      handleAEMessage(follower, msg);
      break;
    case Constants.VOTEREQUEST:
      sendMessage(follower, evaluateCandidate(follower, msg));
      break;
    default:
      console.log("Received an unexpected message", msg.type, msg);
  }
}

function handleAEMessage(follower: Follower, msg: AppendEntriesMessage) {
  follower.lastAE = new Date();
  if (msg.term < follower.term) {
    sendMessage(follower, constructAppendResponse(follower, msg, false));
  } else if (
    msg.plogIdx > 0 &&
    (follower.log.length <= msg.plogIdx ||
      follower.log[msg.plogIdx].term !== msg.plogTerm)
  ) {
    sendMessage(follower, constructAppendResponse(follower, msg, false));
  } else {
    follower.leader = msg.src;
    follower.term = msg.term;
    if (msg.entries.length == 0) {
      return; //heartbeat
    } else {
      updateCommitIndex(follower, msg.lCommit);
      appendEntries(follower, msg.entries, msg.plogIdx + 1);
      sendMessage(follower, constructAppendResponse(follower, msg, true));
    }
  }
}

function updateCommitIndex(follower: Follower, leaderCommit: number) {
  if (leaderCommit > follower.commitIndex) {
    follower.commitIndex = Math.min(follower.log.length - 1, leaderCommit);
  }
}

function appendEntries(
  follower: Follower,
  entries: Command[],
  startIndex: number,
) {
  for (let offset = 0; offset < entries.length; offset++) {
    if (follower.log[startIndex + offset]?.term == entries[offset].term) {
      continue;
    } else {
      if (follower.log[startIndex + offset]) {
        follower.log.splice(startIndex + offset);
      }
      follower.log[startIndex + offset] = entries[offset];
    }
  }
}

function constructAppendResponse(
  follower: Follower,
  msg: AppendEntriesMessage,
  success: boolean,
): AppendResponseMessage {
  return {
    src: follower.config.id,
    dst: msg.src,
    type: Constants.APPENDRESPONSE,
    leader: follower.leader ?? "FFFF",
    idx: msg.plogIdx + 1,
    term: follower.term,
    success,
  };
}

function evaluateCandidate(
  replica: Follower | Candidate,
  msg: VoteRequestMessage,
): VoteResponseMessage {
  if (replica.term > msg.term) {
    return voteResponse(replica, msg, false);
  }
  if (replica.term < msg.term) {
    replica.term = msg.term;
    replica.leader = undefined;
    replica.votedFor = undefined;
  }
  if (
    voteAvailable(replica, msg) &&
    logIsValid(replica, msg.llogTerm, msg.llogIdx)
  ) {
    replica.votedFor = msg.candidateId;
    return voteResponse(replica, msg, true);
  }

  return voteResponse(replica, msg, false);
}

function voteAvailable(replica: Follower | Candidate, msg: VoteRequestMessage) {
  return replica.votedFor === undefined || replica.votedFor === msg.candidateId;
}

function logIsValid(replica: Replica, llogTerm: number, llogIdx: number) {
  const repllogIdx = replica.log.length - 1;
  const repllogTerm = repllogIdx >= 0 ? replica.log[repllogIdx].term : 0;
  return (
    llogTerm > repllogTerm || (llogTerm == repllogTerm && llogIdx >= repllogIdx)
  );
}

function voteResponse(
  replica: Follower | Candidate,
  msg: VoteRequestMessage,
  accept: boolean,
): VoteResponseMessage {
  return {
    src: replica.config.id,
    dst: msg.src,
    type: Constants.VOTERESPONSE,
    leader: Constants.BROADCAST,
    voteGranted: accept,
    term: replica.term,
  };
}

async function checkPulse(follower: Follower) {
  let timer: NodeJS.Timeout;

  const promise = new Promise((resolve, _) => {
    timer = setInterval(() => {
      if (Date.now() - follower.lastAE.getTime() >= follower.electionTimeout) {
        clearInterval(timer);
        resolve(Constants.NOPULSE);
      }
    }, follower.electionTimeout);
  });

  return promise;
}

/**
 * Sends a startup message to the simulator, from this replica.
 *
 * @param {Replica} replica - The replica to send the message to.
 * @throws when `sendMessage` fails
 */
function sendStartupMessage(replica: Follower) {
  const startupMessage = {
    src: replica.config.id,
    dst: Constants.BROADCAST,
    leader: Constants.BROADCAST,
    type: Constants.HELLO,
  };
  sendMessage(replica, startupMessage);
}

export {
  toFollower,
  runFollower,
  handleClientMessage,
  isBusinessMsg,
  isProtoMsg,
  voteResponse,
};
