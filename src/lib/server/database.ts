import { MongoClient, Db, Collection } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

const MONGOURL = process.env.MONGOURL;
if (!MONGOURL) throw new Error('MONGOURL is not set in environment variables');

const DB_NAME = 'Scheduler';
const USERS_COLLECTION = 'userdata';
const EVENTS_COLLECTION = 'events';
const USEREVENTS_COLLECTION = 'userevents';

let client: MongoClient;
let db: Db;
let usersCollection: Collection<User>;
let eventsCollection: Collection<Event>;
let userEventsCollection: Collection<UserEvent>;

async function connectDB() {
	if (!client) {
		client = new MongoClient(MONGOURL!);
		await client.connect();
		db = client.db(DB_NAME);
		usersCollection = db.collection<User>(USERS_COLLECTION);
		eventsCollection = db.collection<Event>(EVENTS_COLLECTION);
		userEventsCollection = db.collection<UserEvent>(USEREVENTS_COLLECTION);
	}
}

// --- User Functions ---

// A type definition for our User object
export type User = {
	username: string;
	password: string; // In a real app, this would be a hashed password!
};

export async function getUsers(): Promise<User[]> {
	await connectDB();
	return usersCollection.find().toArray();
}

export async function addUser(user: User): Promise<void> {
	await connectDB();
	await usersCollection.insertOne(user);
}

// --- Event Functions ---

// A type definition for a single time slot
export type TimeSlot = {
	start: string; // ISO 8601 string
	end: string; // ISO 8601 string
};

// A type definition for an event participant's schedule
export type ParticipantSchedule = Record<string, TimeSlot[]>; // e.g. { "username": [TimeSlot, TimeSlot] }

// A type definition for a full event
export type Event = {
	code: string;
	selectedDates: string[]; // Array of selected dates in 'YYYY-MM-DD' format
	weekOf?: string; // Optional: The Monday of the selected week, e.g., "2024-07-29" (for backward compatibility)
	participants: ParticipantSchedule;
};

// Type definition for the entire events data structure
export type EventsDB = Record<string, Event>; // e.g. { "xyz-123": Event }

export async function getEvents(): Promise<EventsDB> {
	await connectDB();
	const eventsArr = await eventsCollection.find().toArray();
	const events: EventsDB = {};
	eventsArr.forEach((event) => {
		// Remove the _id field to make it serializable
		const { _id, ...eventWithoutId } = event;
		events[event.code] = eventWithoutId as Event;
	});
	return events;
}

export async function getEventByCode(code: string): Promise<Event | undefined> {
	await connectDB();
	const result = await eventsCollection.findOne({ code });
	if (result === null) return undefined;

	// Remove the _id field to make it serializable
	const { _id, ...eventWithoutId } = result;
	return eventWithoutId as Event;
}

export async function updateEvent(event: Event): Promise<void> {
	await connectDB();
	await eventsCollection.updateOne({ code: event.code }, { $set: event }, { upsert: true });
}

// --- UserEvent Functions ---

// A type definition for tracking which users have joined which events
export type UserEvent = {
	username: string;
	eventCode: string;
	joinedAt?: Date;
};

export async function getUserEvents(username: string): Promise<UserEvent[]> {
	await connectDB();
	const userEventsArr = await userEventsCollection.find({ username }).toArray();
	return userEventsArr.map((userEvent) => {
		// Remove the _id field to make it serializable
		const { _id, ...userEventWithoutId } = userEvent;
		return userEventWithoutId as UserEvent;
	});
}

export async function addUserToEvent(username: string, eventCode: string): Promise<void> {
	await connectDB();
	await userEventsCollection.updateOne(
		{ username, eventCode },
		{ $set: { username, eventCode, joinedAt: new Date() } },
		{ upsert: true }
	);
}

export async function removeUserFromEvent(username: string, eventCode: string): Promise<void> {
	await connectDB();
	await userEventsCollection.deleteOne({ username, eventCode });
}

export async function getEventParticipants(eventCode: string): Promise<UserEvent[]> {
	await connectDB();
	const participantsArr = await userEventsCollection.find({ eventCode }).toArray();
	return participantsArr.map((userEvent) => {
		// Remove the _id field to make it serializable
		const { _id, ...userEventWithoutId } = userEvent;
		return userEventWithoutId as UserEvent;
	});
}
