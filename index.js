require('dotenv').config()
const express = require('express')
const cors = require('cors')
const authRoutes = require('./routes/auth')
const eventIdeaRoutes = require('./routes/generateEventIdeas')

const app = express()
app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
  res.send('PTO Central Backend is running')
})

app.use('/auth', authRoutes)
app.use('/api', eventIdeaRoutes)

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`)
})
