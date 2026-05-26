require("dotenv").config()
const { MongoClient } = require("mongodb")
const seedData = require(`./seed-data`).default

async function addSeedData () {
    const uri = process.env.MONGO_URI
    const client = new MongoClient(uri)
    await client.connect()
    const db = client.db("megaphone")
    const result = await db.collection("posts").insertMany(seedData)
    console.log(`Inserted ${result.insertedCount} posts.`)
    await client.close()
}

addSeedData()