import { Constants } from "./util/constants";
import { BusinessMessage, FailMessage } from "./util/message-schemas";
import { Candidate, Config, Follower, ReplicaState } from "./util/types";

/**
 * Sends a message from this replica.
 *
 * @param {Replica} replica - The replica to send the message to.
 * @throws when socket is unable to send a message
 */

function sendMessage(replica: Replica, message: object): void {
  const strMsg = JSON.stringify(message);
  console.log("Sending message:", strMsg);

  replica.config.socket.send(
    Buffer.from(strMsg, "utf-8"),
    replica.config.targetPort,
    "127.0.0.1",
    (e) => {
      if (e) {
        console.error("Error on message transmission", e);
      }
    }
  );
}

function sendFail<T>(
  replica: Follower | Candidate,
  clientRequest: BusinessMessage<T>
) {
  const clientResponse: FailMessage = {
    src: replica.config.id,
    dst: clientRequest.src,
    type: "fail",
    leader: replica.leader,
    MID: clientRequest.MID,
  };
  sendMessage(replica, clientResponse);
}

export { sendStartupMessage, sendMessage, sendFail };
