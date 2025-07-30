
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const passport = require('passport');

const flash = require('connect-flash');
const session = require('express-session');
const ejs = require("ejs");
const path = require('path');
const cors = require("cors");
const PORT = process.env.PORT || 5017
const db = require("./models")
const macAddressMiddleware = require('./middleware/macAddressMiddleware');
// create express server
const app = express();

// Passport authentication Config
require('./config/passport')(passport);

// let the app use cors
app.use(cors());
const bodyParser = require('body-parser');

// ...

// Parse JSON bodies for API requests
app.use(bodyParser.json());


// EJS
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));


// Express session
app.use(
  session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true,
    cookie: {
      secure: false, // Use secure: true if using HTTPS
      maxAge: 60 * 60 * 1000 // 1 hour
    }
  })
);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Connect flash messuages
app.use(flash());
app.use(macAddressMiddleware);
// Global variables
app.use(function(req, res, next) {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  next();
});

app.use(express.static(path.join(__dirname,'./public')));
// app.use('/', require('./routes/index'));
// app.use('/filemanagement', require('./routes/filemanagement'));
// app.use('/cdmsusers', require('./routes/cdmsusers'));
app.use('/selamcdms', require('./routes/index'));

app.use('/selamcdms/filemanagement', require('./routes/filemanagement'));
app.use('/selamcdms/cdmsusers', require('./routes/cdmsusers'));
app.use('/selamcdms/elibrary', require('./routes/elibrary'));
// initialize our app
// {force: true}
// Service Worker Registration for Offline Caching
app.get('/service-worker.js', (req, res) => {
  res.sendFile(path.resolve(__dirname, './public/service-worker.js'));
});

// Synchronization Logic

db.sequelize.sync().then(() => {
 
});


app.listen(PORT, () => {
  console.log(`listening at: http://localhost:${PORT}`)
});
