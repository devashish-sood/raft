import { Command } from "commander";
import dgram from "dgram";
import { Replica, ReplicaOptions } from "./util/types";
import handleMessage from "./receive";
import { Constants } from "./util/constants";
import { sendStartupMessage } from "./send";

/**
 * Composite method to create and setup a replica
 */
async function runReplica() {
  const replica = await createReplica(setupArgs());
  startReplica(replica);
}

/**
 * Create a replica using the given options
 * @param options `ReplicaOptions` for the replica
 *
 * Side effect: Binds a port to the socket for listening purposes
 * @returns an object of type `Replica`
 */
async function createReplica(options: ReplicaOptions): Promise<Replica> {
  const socket = dgram.createSocket("udp4");
  await bindSocket(socket);
  return {
    targetPort: options.targetPort,
    id: options.id,
    others: options.others,
    socket: socket,
    leader: Constants.BROADCAST,
  };
}

/**
 * Sets up replica storage, starts listening for incoming messages, and sends startup message,
 * @param replica the `Replica` object
 */
function startReplica(replica: Replica): void {
  const store: { [key: string]: string } = {};
  replica.socket.on("message", (msg, remoteInfo) => {
    handleMessage(replica, remoteInfo, msg.toString("utf-8"), store);
  });

  sendStartupMessage(replica);
}

/**
 * Binds the given UDP socket to a random available port on the loopback interface.
 *
 * @param {dgram.Socket} socket - The UDP socket to bind.
 * @returns {Promise<void>} A promise that resolves when the socket is bound.
 */
function bindSocket(socket: dgram.Socket): Promise<void> {
  return new Promise((resolve) => {
    socket.bind({ address: "127.0.0.1", port: 0 });
    socket.once("listening", () => {
      const addressInfo = socket.address();
      console.log("Port assigned:", addressInfo);
      resolve();
    });
  });
}

/**
 * Reads in command line arguments for settign up an replica
 * @returns a `ReplicaOptions` object
 */
function setupArgs(): ReplicaOptions {
  const program = new Command();
  program
    .argument("<port>", "Port number")
    .argument("<id>", "Replica ID")
    .argument("[others...]", "Other replica ids")
    .parse();

  const [port, id, ...others] = program.args;
  return {
    targetPort: port ? Number(port) : 8000,
    id: id || "test",
    others: others || [],
  };
}

if (require.main === module) {
  runReplica();
}
