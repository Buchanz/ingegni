require("dotenv").config()
const { MongoClient } = require("mongodb")

async function deleteAllPosts () {
    const uri = process.env.MONGO_URI
    const client = new MongoClient(uri)
    await client.connect()
    const db = client.db("testdb")
    const result = await db.collection("posts").deleteMany({})
    console.log(`Deleted ${result.deletedCount} posts.`)
    await client.close()
}

deleteAllPosts()