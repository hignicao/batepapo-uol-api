import express, { json } from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import joi from "joi";
import { format } from "date-fns";

const participantSchema = joi.object({
	name: joi.string().required(),
});

const messageSchema = joi.object({
	to: joi.string().required(),
	text: joi.string().required(),
	type: joi.string().valid("message", "private_message"),
});

const app = express();

dotenv.config();
app.use(cors());
app.use(json());

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

try {
	await mongoClient.connect();
	db = mongoClient.db("batePapoUOL");
} catch (err) {
	console.log(err);
}

app.post("/participants", async (req, res) => {
	const body = req.body;

	try {
		const findParticipant = await db.collection("participants").findOne({ name: body.name });
		if (findParticipant) {
			res.status(409).send("Participante já cadastrado");
			return;
		}

		const { error } = participantSchema.validate(body);
		if (error) {
			const errors = error.details.map((detail) => detail.message);
			res.status(422).send(errors);
			return;
		}

		await db.collection("participants").insertOne({
			name: body.name,
			lastStatus: Date.now(),
		});

		await db.collection("messages").insertOne({
			from: body.name,
			to: "Todos",
			text: "entra na sala...",
			type: "status",
			time: format(new Date(), "HH:mm:ss"),
		});

		res.sendStatus(201);
	} catch (err) {
		res.status(500).send(err);
	}
});

app.get("/participants", async (req, res) => {
	try {
		const participants = await db.collection("participants").find().toArray();
		res.send(participants);
	} catch (err) {
		console.log(err);
		res.sendStatus(500);
	}
});

app.post("/messages", async (req, res) => {
	const { to, text, type } = req.body;
	const from = req.headers.user;

	try {
		const findParticipant = await db.collection("participants").findOne({ name: from });

		if (!findParticipant) {
			return res.status(422).send("Participante não existe");
		}

		const { error } = messageSchema.validate(req.body, { abortEarly: false });

		if (error) {
			const errors = error.details.map((detail) => detail.message);
			return res.status(422).send(errors);
		}

		await db.collection("messages").insertOne({
			from,
			to,
			text,
			type,
			time: format(new Date(), "HH:mm:ss"),
		});

		res.sendStatus(201);
	} catch (err) {
		res.status(500).send(err);
	}
});

app.get("/messages", async (req, res) => {
	const limit = Number(req.query.limit);
	const from = req.headers.user;

	try {
		const messages = await db.collection("messages").find().toArray();
		const filteredMessages = messages.filter((m) => m.from === from || m.to === from || m.to === "Todos");

		if (limit) {
			res.send(filteredMessages.slice(-limit));
		} else {
			res.send(filteredMessages);
		}
	} catch (err) {
		console.log(err);
		res.sendStatus(500);
	}
});

app.listen(5000, () => {
	console.log("App is running on port 5000");
});
