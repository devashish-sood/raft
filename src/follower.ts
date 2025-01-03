import { sendFail, sendMessage } from "./send";
import { Constants } from "./util/constants";
import { Candidate, Follower, Leader, Replica } from "./util/types";
import {
  ClientMessage,
  Message,
  ProtoMessage,
  VoteRequestMessage,
  VoteResponseMessage,
} from "./util/message-schemas";
import { setInterval, clearInterval } from "timers";
import { toCandidate } from "./candidate";

function toFollower(
  replica: Candidate | Leader,
  newTerm: number,
  newLeader?: string
): Follower {
  return {
    ...replica,
    role: Constants.FOLLOWER,
    currentTerm: newTerm,
    votedFor: undefined,
    leader: newLeader,
  };
}
/**
 * Sets up replica storage, starts listening for incoming messages, and sends startup message,
 * @param config the `Replica` config
 */
async function runFollower(follower: Follower): Promise<Candidate> {
  sendStartupMessage(follower);
  listenForMessages(follower);
  return checkPulse(follower).then<Candidate>(() => toCandidate(follower));
}

function isBusinessMsg(msg: Message<any>): boolean {
  return [Constants.GET, Constants.PUT].includes(msg.type);
}

function isProtoMsg(msg: Message<any>): boolean {
  return [Constants.APPENDENTRIES, Constants.VOTEREQUEST].includes(msg.type);
}

function listenForMessages(follower: Follower) {
  follower.config.socket.on("message", (msg, remoteInfo) => {
    const parsedMessage = JSON.parse(msg.toString("utf-8"));
    if (isBusinessMsg(parsedMessage)) {
      handleClientMessage(follower, parsedMessage);
    } else if (isProtoMsg(parsedMessage)) {
      handleProtoMsg(follower, parsedMessage);
    }
  });
}

function handleClientMessage(
  replica: Follower | Candidate,
  msg: ClientMessage
) {
  replica.leader ? sendRedirect(replica, msg) : sendFail(replica, msg);
}

function sendRedirect(replica: Candidate | Follower, msg: ClientMessage) {
  sendMessage(replica, {
    src: replica.config.id,
    dst: msg.src,
    leader: replica.leader,
    type: "redirect",
    MID: msg.MID,
  });
}

function handleProtoMsg(follower: Follower, msg: ProtoMessage) {
  switch (msg.type) {
    case Constants.APPENDENTRIES:
      follower.lastAA = new Date();
      //Append entry message will be properly acknowledged here
      break;
    case Constants.VOTEREQUEST:
      handleVoteRequest(follower, msg);
      break;
  }
}

function handleVoteRequest(follower: Follower, msg: VoteRequestMessage) {
  sendMessage(follower, evaluateCandidate(follower, msg));
}

function evaluateCandidate(
  follower: Follower,
  msg: VoteRequestMessage
): VoteResponseMessage {
  if (follower.currentTerm > msg.term) {
    return voteResponse(follower, msg, false);
  }
  if (follower.currentTerm < msg.term) {
    follower.currentTerm = msg.term;
    follower.leader = undefined;
    follower.votedFor = undefined;
  }
  if (
    voteAvailable(follower, msg) &&
    logIsValid(follower, msg.llogTerm, msg.llogIdx)
  ) {
    follower.votedFor = msg.candidateId;
    return voteResponse(follower, msg, true);
  }

  return voteResponse(follower, msg, false);
}

function voteAvailable(follower: Follower, msg: VoteRequestMessage) {
  return (
    follower.votedFor === undefined || follower.votedFor === msg.candidateId
  );
}

function logIsValid(replica: Replica, llogTerm: number, llogIdx: number) {
  const repllogIdx = replica.log.length - 1;
  const repllogTerm = repllogIdx >= 0 ? replica.log[repllogIdx].term : 0;
  return (
    llogTerm > repllogTerm || (llogTerm == repllogTerm && llogIdx >= repllogIdx)
  );
}

function voteResponse(
  follower: Follower,
  msg: VoteRequestMessage,
  accept: boolean
): VoteResponseMessage {
  return {
    src: follower.config.id,
    dst: msg.src,
    type: Constants.VOTERESPONSE,
    leader: Constants.BROADCAST,
    voteGranted: accept,
    term: follower.currentTerm,
  };
}

async function checkPulse(follower: Follower) {
  let timer: NodeJS.Timeout;

  const promise = new Promise((resolve, _) => {
    timer = setInterval(() => {
      if (Date.now() - follower.lastAA.getTime() >= follower.electionTimeout) {
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
    type: "hello",
  };
  sendMessage(replica, startupMessage);
}

export {
  toFollower,
  runFollower,
  handleClientMessage,
  isBusinessMsg,
  isProtoMsg,
};
