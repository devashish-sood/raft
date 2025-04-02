import dgram from "dgram";
import { Constants } from "./constants";

type FollowerRole = typeof Constants.FOLLOWER;
type LeaderRole = typeof Constants.LEADER;
type CandidateRole = typeof Constants.CANDIDATE;

/**
 * Represents a replica in the Raft consensus algorithm.
 * @property {number} targetPort - The port number of the replica.
 * @property {string} id - The unique identifier of the replica.
 * @property {string[]} others - The identifiers of other replicas in the cluster.
 * @property {dgram.Socket} socket - The UDP socket used for communication.
 * @property {string} leader - The identifier of the current leader replica.
 */
type Config = {
  targetPort: number;
  id: string;
  others: string[];
  socket: dgram.Socket;
};

type Command = any;

type Role = FollowerRole | LeaderRole | CandidateRole;

/**
 * Represents the state of a replica in the Raft consensus algorithm.
 * @property {ReplicaType} status - Current role status of replica
 * @property {number} currentTerm - Current term of the replica.
 * @property {string} votedFor - Replica vote for current term
 * @property {Command[]} log - Replica command log
 * @property {number} commitIndex - Most recently committed index
 * @property {number} lastApplied - Most recently applied index
 * @property {[key: string]: string} store - key value store
 */
type ReplicaState = {
  currentTerm: number;
  electionTimeout: number;
  votedFor: string | undefined;
  log: Command[];
  commitIndex: number;
  lastApplied: number;
  leader: string | undefined;
  store: { [key: string]: string };
  config: Config;
  lastAA: Date;
};

type Follower = ReplicaState & { role: FollowerRole };
type Leader = ReplicaState & {
  role: LeaderRole;
  nextIndex: { [key: string]: number };

  matchIndex: { [key: string]: number };
};
type Candidate = ReplicaState & {
  role: CandidateRole;
  votes: string[];
};
type Replica = Follower | Candidate | Leader;

/**
 * Represents the data associated with the current leader replica.
 * @typedef {Object} LeaderData
 * @property {Object<string, number>} nextIndex - A map of replica identifiers to the next index to send to each replica.
 */
type LeaderData = {
  nextIndex: { [key: string]: number };
};

/**
 * Represents the options for creating a new replica.
 * @typedef {Object} ReplicaOptions
 * @property {number} targetPort - The port number of the replica.
 * @property {string} id - The unique identifier of the replica.
 * @property {string[]} others - The identifiers of other replicas in the cluster.
 */
interface ReplicaOptions {
  targetPort: number;
  id: string;
  others: string[];
}

export {
  Role,
  Config,
  ReplicaOptions,
  ReplicaState,
  Command,
  Follower,
  Leader,
  Candidate,
  Replica,
};
