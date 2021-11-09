const express = require('express')
const app = express()
const cors = require('cors');
const admin = require("firebase-admin");
require('dotenv').config();
const { MongoClient } = require('mongodb');

const port = process.env.PORT || 5000;

//middleware
// doctors-portal-5958d-firebase-adminsdk-d3ffl-287d31b4a5.json


const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

app.use(cors());
app.use(express.json());

//Mongodb connect
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.d4t4c.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
console.log(uri);
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

//firebase jwt token function
async function verifyToken(req, res, next) {
  if (req.headers.authorization?.startsWith('Bearer ')) {
    const token = req.headers.authorization.split(' ')[1];

    try {
      const decodeUser = await admin.auth().verifyIdToken(token);
      req.decodedEmail = decodeUser.email;
    }
    catch {

    }

  }
  next();
}

//connected database
async function run() {
  try {
    await client.connect();
    console.log('Database Connected Successfully!');
    const database = client.db('doctors-portal');
    const appointmentsCollection = database.collection('appointments');
    const usersCollection = database.collection('users');

    //get appointments from db
    app.get('/appointments',verifyToken, async (req, res) => {
      //email ta query er moddhe astese
      const email = req.query.email;
      const date = new Date(req.query.date).toLocaleDateString();
      //jeta diye filter korbe seta query er moddhe rakhte hobe
      const query = { email: email, date: date };
      const cursor = appointmentsCollection.find(query);
      const appointments = await cursor.toArray();
      res.json(appointments);
    })

    app.post('/appointments', async (req, res) => {
      const appointment = req.body;
      const result = await appointmentsCollection.insertOne(appointment);
      console.log(result);
      res.json(result)
    })
    //get which users are admin
    app.get('/users/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let isAdmin = false;
      if (user?.role === 'admin') {
        isAdmin = true;
      }
      res.json({ admin: isAdmin });
    })

    //post user information to database
    app.post('/users', async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      console.log(result);
      res.json(result);
    })

    //put or upsert, google login data in database
    app.put('/users', async (req, res) => {
      const user = req.body;
      const filter = { email: user.email };
      const option = { upsert: true };
      const updateDoc = { $set: user };
      const result = await usersCollection.updateOne(filter, updateDoc, option);
      res.json(result);
    })

    //make a user to admin
    app.put('/users/admin', verifyToken, async (req, res) => {
      const user = req.body;
      const requester = req.decodedEmail;
      if (requester) {
        const requesterAcount = await usersCollection.findOne({ email: requester });
        if (requesterAcount.role === 'admin') {
          const filter = { email: user.email };
          const updateDoc = { $set: { role: 'admin' } };
          const result = await usersCollection.updateOne(filter, updateDoc);
          res.json(result);
        }
      }
      else{
        res.status(403).json({message: 'you do not have access to admin.'})
      }
     
    })

  }
  finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello Doctors Uncle!')
})

app.listen(port, () => {
  console.log(` listening at http://localhost:${port}`)
})