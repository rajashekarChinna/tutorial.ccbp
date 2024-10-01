const express = require('express')
const app = express()

const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const dbPath = path.join(__dirname, 'twitterClone.db')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
let db = null
app.use(express.json())

const initilizationAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () =>
      console.log('server runing at http://localhost:3000/'),
    )
  } catch (error) {
    console.log(`Db error ${error.message}`)
    process.exit(1)
  }
}

initilizationAndServer()

app.post('/register/', async (request, response) => {
  const {username, password, name, gender} = request.body

  const userRegister = `select * from user where username = "${username}"`
  const dbUser = await db.get(userRegister)
  if (dbUser === undefined) {
    if (password.length < 6) {
      response.status(400)
      response.send('Password is too short')
    } else {
      const hashedPassword = await bcrypt.hash(password, 10)
      const registerquery = `insert into user(username, password, name, gender) values("${username}", "${hashedPassword}", "${name}", "${gender}")`
      await db.run(registerquery)
      response.send('User created successfully')
    }
  } else {
    response.status(400)
    response.send('User already exists')
  }
})

const authenticationToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'rajashekar_chinna', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.username = payload.username
        next()
      }
    })
  }
}

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const payload = {username}
  const jwtToken = jwt.sign(payload, 'rajashekar_chinna')
  const userLoingQuery = `select * from user where username = "${username}"`
  const dbUser = await db.get(userLoingQuery)
  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password)
    if (isPasswordMatched) {
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

const isUserFollower = async (request, response, next) => {
  const {tweetId} = request.params
  const {username} = request.headers
  const getUserQuery = `selsect * from user where username = '${username}'`
  const dbUser = await db.get(getUserQuery)
  const userId = dbUser['user_id']

  const followingQuery = `select following_user_id from follower where follower_user_id = "${userId}"`
  const userFollowing = await db.all(followingQuery)

  const userTweet = `select * from tweet where tweet_id = "${tweetId}"`
  const tweetData = await db.get(userTweet)
  const tweetUserId = tweetData['user_id']

  let isTweetUser = false
  userFollowing.forEach(each => {
    if (each['following_user_id'] === tweetUserId) {
      isTweetUser = true
    }
  })
  if (isTweetUser) {
    next()
  } else {
    response.status(401)
    response.send('Invalid Request')
  }
}

app.get(
  '/user/tweets/feed/',
  authenticationToken,
  async (request, response) => {
    const {username} = request.headers
    const getUserQuery = `select * from  user where username = "${username}"`
    const dbUser = await db.get(getUserQuery)
    const userId = dbUser['user_id']

    const getUser = ` select username, tweet, date_time as dataTime from follower inner join tweet on follower.following_user_id = tweet.user_id natural join user where follower.follower_user_id = "${userId}" order by dateTime desc limit = 4"`
    const data = await db.all(getUser)
    response.send(data)
  },
)

app.get('/user/following/', authenticationToken, async (request, response) => {
  const {username} = request.headers
  const getUserQuery = `select * from user where username = "${username}"`
  const dbUser = await db.get(getUserQuery)
  const userId = dbUser['user_id']
  const userFollowerQuery = `select name from follower inner join user on follower.following_user_id = user.user_id where follower.follower_user_id = ${userId}`
  const data = await db.get(userFollowerQuery)
  response.send(data)
})

app.get('/user/followers/', authenticationToken, async (request, response) => {
  const {username} = request.headers
  const getUserQuery = `select * from user where username = "${username}"`
  const dbUser = await db.get(getUserQuery)
  const userId = dbUser['user_id']

  const query = `select name from follower inner join user on follower.follower_usr_id = user.user_id where following_user_id = ${userId}`
  const data = await db.get(query)
  response.send(data)
})

app.get(
  '/tweets/:tweetId/',
  authenticationToken,
  isUserFollower,
  async (request, response) => {
    const {tweetId} = request.params
    const getTweetIdDetails = `select tweets count() as replies, date_time as dateTime from tweet inner join reply on tweet.tweet_id = reply.tweet_id where tweet.tweet_id = "${tweetId}"`
    const data = await db.get(getTweetIdDetails)

    const likesQuerys = `select  likes from like where tweet_id = "${tweetId}"`
    const {likes} = await d.get(likesQuerys)
    data.likes = likes
    response.send(data)
  },
)

//API 7

app.get(
  '/tweets/:tweetId/likes/',
  authenticationToken,
  isUserFollower,
  async (request, response) => {
    const {tweetId} = request.params
    const getQuery = `select name, reply from reply jatural join user where tweet_id = "${tweetId}"`
    const data = await db.all(getQuery)
    const userName = data.map(eachUser => eachUser.username)
    response.send({likes: userName})
  },
)

//API 8

app.get(
  '/tweets/:tweetId/replies/',
  authenticationToken,
  isUserFollower,
  async (request, response) => {
    const {tweetId} = request.params
    const userQuery = `select name, reply from reply natural join user where tweet_id = ${tweetId}`
    const data = await db.all(userQuery)
    response.send(data)
  },
)

//API 9

app.get('/user/tweets/', authenticationToken, async (request, response) => {
  const {username} = request.headers
  const getUserQuery = `select * from user where username = "${username}"`
  const dbUser = await db.get(getUserQuery)
  const userId = dbUser['user_id']

  const tweetsCount = `select tweet, count as likes, date_time as dateTime from tweet inner join like on tweet.tweet_id = like.tweet_id where tweet.user_id = ${userId} group by tweet.tweet_id`
  let likesData = await db.all(tweetsCount)

  const repliesData = `select tweet, count() as replies from tweet inner join reply on tweet.tweet_id = reply.tweet_id where tweet.user_id = ${userId} group by tweet.tweet_id`
  const repliesDetails = await db.all(repliesData)

  likesData.forEach(each => {
    for (let data of repliesDetails) {
      if (each.tweet === data.tweet) {
        each.replies = data.replies
        break
      }
    }
  })
  response.send(likesData)
})

//API 10

app.post('/user/tweets/', authenticationToken, async (request, response) => {
  const {tweet} = request.body
  const {username} = request.headers
  const getUserQuery = `select * from user where username = "${username}"`
  const dbUser = await db.all(getUserQuery)
  const userId = dbUser['user_id']

  const query = `insert into tweet(tweet, user_id) values("${tweet}", ${userId})`
  await db.run(query)
  response.send('Created a Tweet')
})

//API

app.delete(
  '/tweets/:tweetId/',
  authenticationToken,
  async (request, response) => {
    const {tweetId} = request.params
    const {username} = request.headers
    const getUserDetails = `select * from  user where username = "${username}"`
    const dbUser = await db.get(getUserDetails)
    const userId = dbUser['user_id']

    const userTweetQuery = `select tweet_id, user_id from tweet where user_id = "${userId}"`
    const userTweetData = await db.all(userTweetQuery)

    let isTweetUser = false

    userTweetData.forEach(each => {
      if (each['tweet_id'] == tweetId) {
        isTweetUser = true
      }
    })

    if (isTweetUser) {
      const query = 'DELETE FROM tweet WHERE tweet_id = ${tweetId};'
      await db.run(query)
      response.send('Tweet Removed')
    } else {
      response.status(401)
      response.send('Invalid Request')
    }
  },
)

module.exports = app
