import dgram from "dgram";
import { Config, Follower, Replica, ReplicaOptions } from "./util/types";
import { Constants } from "./util/constants";
import { randomInt } from "crypto";
import { runFollower } from "./follower";
import { runCandidate } from "./candidate";
import { runLeader } from "./leader";
import { Command } from "commander";
import { sendMessage } from "./send";

/**
 * Composite method to create and setup a replica
 */
async function runReplica() {
  let replica: Replica = createReplica(await createConfig(setupArgs()));
  sendStartupMessage(replica);
  while (true) {
    switch (replica.role) {
      case Constants.FOLLOWER: {
        replica = await runFollower(replica);
        break;
      }
      case Constants.CANDIDATE: {
        replica = await runCandidate(replica);
        break;
      }
      case Constants.LEADER: {
        replica = await runLeader(replica);
        break;
      }
    }
  }
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

/**
 * Create a replica using the given options
 * @param options `ReplicaOptions` for the replica
 *
 * Side effect: Binds a port to the socket for listening purposes
 * @returns an object of type `Replica`
 */
async function createConfig(options: ReplicaOptions): Promise<Config> {
  const socket = dgram.createSocket("udp4");
  await bindSocket(socket);
  return {
    targetPort: options.targetPort,
    id: options.id,
    others: options.others,
    socket: socket,
  };
}

function createReplica(config: Config): Follower {
  return {
    role: Constants.FOLLOWER,
    leader: Constants.BROADCAST,
    term: 0,
    electionTimeout: randomInt(175, 325),
    votedFor: undefined,
    log: [],
    commitIndex: -1,
    lastApplied: 0,
    store: {},
    config,
    lastAE: new Date(),
  };
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
      console.log("port assigned:", addressInfo);
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
