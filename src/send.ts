import { Constants } from "./util/constants";
import { BusinessMessage, FailMessage } from "./util/message-schemas";
import { Replica } from "./util/types";

/**
 * Sends a startup message to the simulator, from this replica.
 *
 * @param {Replica} replica - The replica to send the message to.
 * @throws when `sendMessage` fails
 */
function sendStartupMessage(replica: Replica) {
  const startupMessage = {
    src: replica.id,
    dst: Constants.BROADCAST,
    leader: Constants.BROADCAST,
    type: "hello",
  };
  sendMessage(replica, startupMessage);
}

/**
 * Sends a message from this replica.
 *
 * @param {Replica} replica - The replica to send the message to.
 * @throws when socket is unable to send a message
 */

function sendMessage(replica: Replica, message: object): void {
  const strMsg = JSON.stringify(message);
  console.log("Sending message:", strMsg);

  replica.socket.send(
    Buffer.from(strMsg, "utf-8"),
    replica.targetPort,
    "127.0.0.1",
    (e) => {
      if (e) {
        console.error("Error on message transmission", e);
      }
    }
  );
}

function sendFailResponse<T>(
  replica: Replica,
  clientRequest: BusinessMessage<T>
) {
  const clientResponse: FailMessage = {
    src: clientRequest.dst,
    dst: clientRequest.src,
    type: "fail",
    leader: replica.leader,
    MID: clientRequest.MID,
  };
  sendMessage(replica, clientResponse);
}

export { sendStartupMessage, sendMessage, sendFailResponse };
