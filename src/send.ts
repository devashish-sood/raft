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
): Promise<boolean> {
  const strMsg = JSON.stringify(message);
  console.log("sending:", strMsg);

  return new Promise((resolve, reject) => {
    replica.config.socket.send(
      Buffer.from(strMsg, "utf-8"),
      replica.config.targetPort,
      "127.0.0.1",
      (e) => {
        if (e) {
          console.error("Error on message transmission", e, strMsg);
          reject(e);
        } else {
          resolve(true);
        }
      },
    );
  });
}

function sendBatch<T extends Message<MessageType>>(
  replica: Replica,
  msgConstructor: (n: string) => T,
) {
  const promises = replica.config.others.map((name) =>
    sendMessage(replica, msgConstructor(name)),
  );

  Promise.all(promises).then((results) => {
    if (!results.every((result) => result === true)) {
      console.error("Not all vote requests were successfully sent", replica);
    }
  });
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

export { sendMessage, sendBatch, sendFail };
