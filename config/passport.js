
const LocalStrategy = require('passport-local').Strategy;

const bcrypt = require('bcryptjs');
const { response } = require('express');
const axios = require('axios');

const db = require("../models")
const Op = db.Sequelize.Op;
var existeduser;

module.exports = function(passport) {
  passport.use(
    new LocalStrategy({ usernameField: 'username' }, (username, password, done) => {
      // Match user
      db.User.findOne({  where: {
        username: username
    }}).then(data => {
      console.log(data)
        if(!data)
        {
            return done(null,false,{ message: 'Invalid Credential' });
        }
     //   const isValid=validPassword(password,results[0].hash,results[0].salt);
     existeduser={userid:data.user_id,username:data.username,password:data.password,department:data.department
      };
     console.log(data);
        bcrypt.compare(password, existeduser.password, (err, isMatch) => {
          if (err) throw err;
          if (isMatch) {
            return done(null, existeduser);
          } else {
            return done(null, false, { message: 'Password incorrect' });
          }
        });
    });
    
    })


  );


  passport.serializeUser(function(existeduser, done) {
    done(null, existeduser.userid);
  });

  passport.deserializeUser(function(userid, done) {
    db.User.findOne({where:{user_id:userid}}).then(data => {
      done(null, data);    
});
  });

};