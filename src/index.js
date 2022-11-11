import express, { json } from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import joi from "joi";
import { format } from "date-fns";

const participantsSchema = joi.object({
	name: joi.string().required(),
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

	const validation = participantsSchema.validate(body);

	if (validation.error) {
		const errors = validation.error.details.map((detail) => detail.message);
		res.status(422).send(errors);
		return;
	}

	try {
		const findParticipant = await db.collection("participants").findOne({ name: body.name });

		if (findParticipant) {
			res.status(409).send("Participante já cadastrado");
			return;
		}

		await db.collection("participants").insert({
			name: body.name,
			lastStatus: Date.now(),
		});

		await db.collection("messages").insert({
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

app.listen(5000, () => {
	console.log("App is running on port 5000");
});
