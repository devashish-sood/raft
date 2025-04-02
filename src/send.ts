import { Constants } from "./util/constants";
import {
  BusinessMessage,
  FailMessage,
  Message,
  MessageType,
} from "./util/message-schemas";
import { Replica } from "./util/types";

/**
 * Sends a message from this replica.
 *
 * @param {Replica} replica - The replica to send the message to.
 * @throws when socket is unable to send a message
 */

function sendMessage<T extends Message<MessageType>>(
  replica: Replica,
  message: T,
): void {
  const strMsg = JSON.stringify(message);
  console.log("sending:", strMsg);

  replica.config.socket.send(
    Buffer.from(strMsg, "utf-8"),
    replica.config.targetPort,
    "127.0.0.1",
    (e) => {
      if (e) {
        console.error("Error on message transmission", e);
      }
    },
  );
}

function sendFail(replica: Replica, clientRequest: BusinessMessage) {
  const clientResponse: FailMessage = {
    src: replica.config.id,
    dst: clientRequest.src,
    type: "fail",
    leader: replica.leader ?? Constants.BROADCAST,
    MID: clientRequest.MID,
  };
  sendMessage(replica, clientResponse);
}

export { sendMessage, sendFail };
