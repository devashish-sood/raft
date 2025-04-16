import { sendFail, sendMessage } from "./send";
import { Constants } from "./util/constants";
import { Candidate, Follower, Leader, Replica } from "./util/types";
import {
  BusinessMessage,
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
    currentTerm: newTerm,
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
      follower.lastAE = new Date();
      //Append entry message will be properly acknowledged here
      //TODO: implement
      // need to make sure the leader is legitimate before doing stuff. might also have to recognize a leader change -- unsure
      break;
    case Constants.VOTEREQUEST:
      sendMessage(follower, evaluateCandidate(follower, msg));
      break;
    default:
      console.log("Received an unexpected message", msg.type, msg);
  }
}

function evaluateCandidate(
  replica: Follower | Candidate,
  msg: VoteRequestMessage,
): VoteResponseMessage {
  if (replica.currentTerm > msg.term) {
    return voteResponse(replica, msg, false);
  }
  if (replica.currentTerm < msg.term) {
    replica.currentTerm = msg.term;
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
    term: replica.currentTerm,
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
};
