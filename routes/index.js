const express = require('express');
const router = express.Router();

const db = require('../models');

const sequelize = db.sequelize ;
const { Op } = require("sequelize");
const bcrypt = require('bcryptjs');
const passport = require('passport');
const { v4: uuidv4 } = require('uuid');
const { ensureAuthenticated, forwardAuthenticated } = require('../config/auth');
const path = require("path");
const fs = require('fs');
const axios = require('axios');
const archiver = require('archiver');
const mysqldump = require('mysqldump');
let isSyncing = false; // Global variable to track sync status

async function checkSyncStatus(req, res, next) {
  try {
    // Start sync process i
    //  isSyncing = true; n the background
     isSyncing = true; 
    (async () => {
      console.log('Starting background synchronization...');
      const response = await axios.get('http://196.189.61.123:8080/selamcdms/sync'); // Fetch changes from the cloud server
      const { changes } = response.data;

      if (!changes || Object.keys(changes).length === 0) {
        console.log('Data is already synced');
        return;
      }

      // Sync folders
      if (changes.folders && changes.folders.length > 0) {
        for (const folder of changes.folders) {
          await db.Folder.upsert(folder); // Upsert folder data into the local database
        }
        console.log('Folders synced successfully');
      }

      // Sync files
      if (changes.files && changes.files.length > 0) {
        for (const file of changes.files) {
          const folderExists = await db.Folder.findOne({ where: { id: file.folderId } });
          if (!folderExists) {
            console.log(`Referenced folder with ID ${file.folderId} does not exist. Creating folder.`);
            await db.Folder.create({ id: file.folderId, name: 'Unknown Folder' });
          }

          const filePath = path.join(__dirname, '../public', file.filePath);
          if (!fs.existsSync(filePath)) {
            console.log(`File "${file.filePath}" does not exist in the file system. Downloading...`);
            try {
              const folderPath = path.dirname(filePath);
              if (!fs.existsSync(folderPath)) {
                fs.mkdirSync(folderPath, { recursive: true });
              }

              const fileUrl = `http://196.189.61.123:8080/selamcdms${file.filePath}`;
              const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
              fs.writeFileSync(filePath, response.data);
              console.log(`File "${file.filePath}" downloaded and saved successfully.`);
            } catch (error) {
              console.error(`Failed to download file "${file.filePath}":`, error.message);
              continue;
            }
          }

          await db.File.upsert(file);
          console.log(`File "${file.filePath}" synced successfully.`);
        }
      }

      // Sync users
      if (changes.users && changes.users.length > 0) {
        for (const user of changes.users) {
          await db.User.upsert(user);
        }
        console.log('Users synced successfully');
      }

      // Sync departments
      if (changes.departments && changes.departments.length > 0) {
        for (const department of changes.departments) {
          await db.Department.upsert(department);
        }
        console.log('Departments synced successfully');
      }

      console.log('Background synchronization completed successfully');
    })();

    // Proceed to render the login screen
    next();
  } catch (error) {
    console.error('Error during synchronization:', error.message);
    req.flash('error_msg', 'Failed to sync data from the cloud. Please try again later.');
     isSyncing = false; // Sync process ends
    next(); // Proceed to render the login screen even if sync fails
  }
}
router.get('/', forwardAuthenticated,(req, res) => res.render('login'));

router.get('/syncstatus', (req, res) => {
  res.json({ syncing: isSyncing });
});

router.get('/login', forwardAuthenticated, (req, res) => res.render('login',{
   error_msg: req.flash('error_msg'), 
}));
router.get('/backupdatabasecdms', ensureAuthenticated, async function (req, res) {
  const now = new Date();
  const filename = `SelamCDMS_DB_BackUp_DateOn-${now.toISOString().replace(/:/g, '-')}.sql`;  // Safe filename with dashes
  const filePath = path.join(__dirname, 'backups', filename);  // Save in the 'backups' folder

  console.log("Backup file path:", filePath);

  // Ensure the backups folder exists
  const backupsDir = path.join(__dirname, 'backups');
  if (!fs.existsSync(backupsDir)) {
      console.log("Creating backups directory...");
      fs.mkdirSync(backupsDir, { recursive: true });
  } else {
      console.log("Backups directory already exists.");
  }

  try {
      // Perform the database dump
      const result = await mysqldump({
          connection: {
              user: "selamdbuser",
              host: "localhost",
              password: "R1445o123/",
              database: "selamcdms",
          },
          dump: {
              data: {
                  format: false
              }
          },
          dumpToFile: filePath,  // Save the dump to the filePath
      });

      // If successful, send the file to the user for download
      if (result) {
          res.download(filePath, filename, (err) => {
              if (err) {
                  console.error("Error during file download", err);
                  res.status(500).send("Could not download the file.");
              } else {
                  console.log('Backup file is available for download.');
              }
          });
      }
  } catch (error) {
      console.error("Error during backup process:", error);
      res.status(500).send("Error during the backup process.");
  }
});
router.get('/downloadalluploads', ensureAuthenticated, async function (req, res) {
  try {
    // Define the zip filename with current timestamp
    const now = new Date();
    const zipFilename = `Uploads_BackUp_DateOn-${now.toISOString().replace(/:/g, '-')}.zip`;
    const zipFilePath = path.join(__dirname, 'backups', zipFilename);

    // Ensure the backups folder exists (if it doesn't, create it)
    const backupsDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupsDir)) {
      console.log("Creating backups directory...");
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    // Create a stream to write the zip file
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Max compression
    });

    // Pipe the archive output to the zip file
    archive.pipe(output);

    // Add the entire 'uploads' folder to the zip
    const uploadsDir = path.join(__dirname, '../public/uploads');
    
    // Check if the uploads directory exists
    if (fs.existsSync(uploadsDir)) {
      // Add files from the uploads directory to the zip
      archive.directory(uploadsDir, 'uploads');
    } else {
      return res.status(404).send("Uploads directory does not exist.");
    }

    // Finalize the archive (i.e., complete the zip creation process)
    archive.finalize();

    // After the zip is finalized, send it to the user for download
    output.on('close', function () {
      console.log('Backup zip file has been finalized and the stream is closed.');
      res.download(zipFilePath, zipFilename, (err) => {
        if (err) {
          console.error('Error downloading the backup file:', err);
          res.status(500).send("Could not download the backup file.");
        } else {
          console.log('Backup zip file available for download.');
        }

        // Clean up the temporary zip file after download
        fs.unlinkSync(zipFilePath);
      });
    });

  } catch (error) {
    console.error('Error during file zipping:', error);
    res.status(500).send('Error during file zipping.');
  }
});
router.get('/sync', async (req, res) => {
  try {
    // Fetch unsynced data from multiple tables
    const unsyncedUsers = await db.User.findAll({ where: { synced: false } });
    const unsyncedDepartments = await db.Department.findAll({ where: { synced: false } });
    const unsyncedFiles = await db.File.findAll({ where: { synced: false } });
    const unsyncedFolders = await db.Folder.findAll({ where: { synced: false } });

    // Combine all unsynced data into a single response
    const changes = {
      users: unsyncedUsers.map(user => user.toJSON()),
      departments: unsyncedDepartments.map(department => department.toJSON()),
      files: unsyncedFiles.map(file => file.toJSON()),
      folders: unsyncedFolders.map(folder => folder.toJSON()),
    };

    res.status(200).json({ changes });
  } catch (error) {
    console.error('Error fetching unsynced changes:', error);
    res.status(500).json({ error: 'Failed to fetch changes', details: error.message });
  }
});
router.get('/dashboard', ensureAuthenticated, async (req, res) => {
    try {
      // Query the total number of Active Users
      const [activeUsersData] = await db.sequelize.query(`
        SELECT COUNT(*) AS active_users
        FROM Users
      `);
  
      // Query the total number of Folders
      const [foldersCreatedData] = await db.sequelize.query(`
        SELECT COUNT(*) AS folders_created
        FROM Folders
      `);
  
      // Query the total number of Files
      const [filesCreatedData] = await db.sequelize.query(`
        SELECT COUNT(*) AS files_created
        FROM Files
      `);
  
      // Extract the counts from the data
      const activeUsersCount = activeUsersData[0] ? activeUsersData[0].active_users : 0;
      const foldersCreatedCount = foldersCreatedData[0] ? foldersCreatedData[0].folders_created : 0;
      const filesCreatedCount = filesCreatedData[0] ? filesCreatedData[0].files_created : 0;
    const departments = await db.Department.findAll();
      // Render dashboard based on user role
      if (req.user.user_roll === 'User') {
        return res.render('userdashboard', { 
          activeUsersCount, 
          foldersCreatedCount, departments,
          filesCreatedCount, 
          user: req.user 
        });
      }
  
      res.render('dashboard', { 
        activeUsersCount, departments,
        foldersCreatedCount, 
        filesCreatedCount, 
        user: req.user 
      });
  
    } catch (error) {
      console.error("Error fetching data:", error);
      res.status(500).send("Error fetching data");
    }
  });
  
  router.post('/sync-to-cloud', async (req, res) => {
  try {
    await syncWithCloud(); // Trigger sync to cloud
    res.status(200).json({ message: 'Synchronization to cloud successful' });
  } catch (error) {
    console.error('Error syncing to cloud:', error.message);
    res.status(500).json({ error: 'Synchronization to cloud failed' });
  }
});
  
    async function syncWithCloud() {
  try {
    const changes = await db.getUnsyncedChanges(); // Fetch unsynced changes from the local database
    if (!changes || changes.length === 0) {
      console.log('No changes to sync to cloud');
      return;
    }

    const response = await axios.post('https://your-cloud-server.com/sync', { changes }); // Send changes to the cloud server
    if (response.status === 200) {
      await db.markChangesAsSynced(changes); // Mark changes as synced in the local database
      console.log('Synchronization to cloud successful');
    } else {
      console.error('Synchronization to cloud failed:', response.data);
    }
  } catch (error) {
    console.error('Error syncing to cloud:', error.message);
  }
}
// Periodic Sync
setInterval(() => {
  syncWithCloud();
}, 5 * 60 * 1000); // Sync every 5 minutes

router.post('/login', (req, res, next) => {
    passport.authenticate('local', {
        successRedirect: '/selamcdms/dashboard',
        failureRedirect: '/selamcdms/login',
        failureFlash: true
    })(req, res, next);
});

router.post('/changepassword',ensureAuthenticated,async function (req, res)  {
    const {confirmNewPassword,newPassword,currentPassword} = req.body;
 console.log(req.body);
    let errors =[];
if(!currentPassword || !newPassword ){
errors.push({msg:"please enter all required fields!"})
}

const [activeUsersData] = await db.sequelize.query(`
    SELECT COUNT(*) AS active_users
    FROM Users
  `);

  // Query the total number of Folders
  const [foldersCreatedData] = await db.sequelize.query(`
    SELECT COUNT(*) AS folders_created
    FROM Folders
  `);

  // Query the total number of Files
  const [filesCreatedData] = await db.sequelize.query(`
    SELECT COUNT(*) AS files_created
    FROM Files
  `);
  const activeUsersCount = activeUsersData[0] ? activeUsersData[0].active_users : 0;
  const foldersCreatedCount = foldersCreatedData[0] ? foldersCreatedData[0].folders_created : 0;
  const filesCreatedCount = filesCreatedData[0] ? filesCreatedData[0].files_created : 0;

if(errors.length >0){
    if (req.user.user_roll === 'User') {
        return res.render('dashboarduser', {     activeUsersCount, 
            foldersCreatedCount, 
            filesCreatedCount, 
            errors,user: req.user });
      }
      res.render('dashboard', {     activeUsersCount, 
        foldersCreatedCount, 
        filesCreatedCount, errors, user: req.user });
}
else{
    db.User.findOne({where:{user_id:req.user.user_id}}).then(user =>{
        if(user){
            var op = user.password;
            bcrypt.compare(currentPassword,op, (err, isMatch) => {
                if (err) throw err;
                if (isMatch) {
                    bcrypt.hash(newPassword, 10, (err, hash) => {
       
                        db.User.update({password:hash},{where:{user_id:req.user.user_id}}).then(user =>{
                           
                            if (req.user.user_roll === 'User') {
                                return res.render('dashboarduser', {
                                    activeUsersCount, 
                                    foldersCreatedCount, 
                                    filesCreatedCount, 
                                    success_msg:"You Are Successfully Update Your Password ", user: req.user });
                              }
                              res.render('dashboard', {     activeUsersCount, 
                                foldersCreatedCount, 
                                filesCreatedCount,  user: req.user });
                         }).catch(err =>{
                            
                            if (req.user.user_roll === 'User') {
                                return res.render('dashboarduser', {
                                    activeUsersCount, 
                                    foldersCreatedCount, 
                                    filesCreatedCount, 
                                    error_msg:"Error While Change Password ", user: req.user });
                              }
                              res.render('dashboard', {      activeUsersCount, 
                                foldersCreatedCount, 
                                filesCreatedCount, user: req.user });
                         })
                        }); 
                } else{

                    if (req.user.user_roll === 'User') {
                        return res.render('dashboarduser', {
                            activeUsersCount, 
                            foldersCreatedCount, 
                            filesCreatedCount, 
                            error_msg:'Old Password Not Correct', user: req.user });
                      }
                    res.render('dashboard',{     activeUsersCount, 
                        foldersCreatedCount, 
                        filesCreatedCount, error_msg:'Old Password Not Correct',user: req.user})
                    
                }
              });
        }else{
         
            if (req.user.user_roll === 'User') {
                return res.render('dashboarduser', {
                    activeUsersCount, 
                    foldersCreatedCount, 
                    filesCreatedCount, 
                    error_msg:'User Not Find Try Later', user: req.user });
              }
            res.render('dashboard',{     activeUsersCount, 
                foldersCreatedCount, 
                filesCreatedCount, error_msg:'User Not Find Try Later',user: req.user})
        }
    }).catch(err =>{
        console.log(err)
     
        if (req.user.user_roll === 'User') {
            return res.render('dashboarduser', {     activeUsersCount, 
                foldersCreatedCount, 
                filesCreatedCount, 
                error_msg:'Error While Change Password', user: req.user });
          }
        res.render('dashboard',{     activeUsersCount, 
            foldersCreatedCount, 
            filesCreatedCount, error_msg:'Error While Change Password',user: req.user})
                    
    })
   
  

}

});  
  // Logout
router.get('/logout', (req, res) => {
    req.logout();
    req.flash('success_msg', 'You are logged out');
    res.redirect('/selamcdms/login');
});

router.get('/createuser', ensureAuthenticated,async function (req, res, next) {
    
    const userlist  =  await db.User.findAll({});
    const deptnames = await db.Department.findAll({});
    res.render('createuser',{user:req.user,userlist,deptnames})
  });

  router.get('/createdepartment', ensureAuthenticated,async function (req, res, next) {
    
    const userlist  =  await db.User.findAll({});
    const deptnames = await db.Department.findAll();
    res.render('createdepartment',{user:req.user,userlist,deptnames})
  });


 router.get('/createoccupation', ensureAuthenticated,async function (req, res, next) {
    
    const userlist  =  await db.User.findAll({});
    const deptnames = await db.Department.findAll({where:{is_dept:'Yes'}});
     const occlist = await db.Occupation.findAll();
    res.render('createoccupation',{user:req.user,userlist,deptnames,occlist})
  });
router.post('/addnewoccupation',ensureAuthenticated, async function(req, res) 
{
    const {departmentname,occupationame} = req.body;
         const occlist = await db.Occupation.findAll();
    const deptnames = await db.Department.findAll({});
     console.log("iwansheredept");
     console.log(departmentname);
    let errors = [];
 
    if (!departmentname || !occupationame){
        errors.push({ msg: 'Please add all required fields' });
       
    }
 
   if(errors.length >0){
    res.render('addusercredential',{
        errors,
        deptnames:deptnames,
      user :req.user
    })
   }
   else{
    db.Occupation.findOne({where:{
        departmentid:departmentname,
        occupationname:occupationame
       }}).then(user =>{
           if(user)
           {

            res.render('createoccupation',{
             
                error_msg:'This occupation name is already registered please change',
                deptnames:deptnames,
                user:req.user,occlist
            })
           }
           else
           {
   
            db.Occupation.create({
                departmentid:departmentname,
                occupationname:occupationame
            }).then(user =>{
                if(!user){
                 res.render('createoccupation',{
                   
                     error_msg:'Something is wrong while saving data please try later',
                     deptnames:deptnames,
                     user:req.user,occlist
                 })
                }
                 res.render('createoccupation',{  
     
                     success_msg:'Your are successfully registered new  department',
                     deptnames:deptnames,
                     user:req.user,occlist
                 })
             }).catch(error =>{
                 res.render('createoccupation',{
                   
                     error_msg:'Something is wrong while saving data please try later',
                     deptnames:deptnames,
                     user:req.user,occlist
                 })
             })


           }
       }).catch(error =>{
           console.log(error)
        res.render('createoccupation',{
            deptnames,user:req.user,occlist,
            error_msg:'Something is wrong please try later'
        })
       })
   }
   
   
});

router.post('/addnewsystemuser',ensureAuthenticated, async function(req, res) 
{
    const {username,password,userroll,department,fullname} = req.body;
    const deptnames = await db.Department.findAll({});
   
  const userlist = await db.User.findAll({});
    let errors = [];
 
    if (!username || !password || !department || department ==="0" || !userroll || !fullname){
        errors.push({ msg: 'Please add all required fields' });
       
    }

   if(errors.length >0){
    res.render('addusercredential',{
        errors,
        deptnames:deptnames,
       user:req.user,
        userlist:userlist
    })
   }
   else{
    db.User.findOne({where:{
        username:username,
        
       }}).then(user =>{
           if(user)
           {

            res.render('createuser',{
             
                error_msg:'This user name is already registered please change',
                deptnames:deptnames,
                user:req.user,
                 userlist:userlist
            })
           }
           else
           {
        
     
        bcrypt.genSalt(10, (err, salt) => {
            bcrypt.hash(password, salt, (err, hash) => {
              if (err) throw err;
            var  newpassword = hash;
            const userData ={
          
                user_id: uuidv4(),
                username: username,
                password: newpassword,
                user_roll:userroll,
                fullname:fullname,
                is_active: "Yes",
                fullname: username,
                department:department
           
            }

        db.User.create(userData).then(user =>{
           if(!user){
            res.render('createuser',{
              
                error_msg:'Something is wrong while saving data please try later',
                deptnames:deptnames,
                user:req.user,
                 userlist:userlist
            })
           }
            res.render('createuser',{  

                success_msg:'Your are successfully registered new system user',
                deptnames:deptnames,
                user:req.user,
                 userlist:userlist
            })
        }).catch(error =>{
            res.render('createuser',{
              
                error_msg:'Something is wrong while saving data please try later',
                deptnames:deptnames,
                user:req.user,
                 userlist:userlist
            })
        })
            })
          });



           }
       }).catch(error =>{
           console.log(error)
        res.render('createuser',{
            deptnames:deptnames,
       user:req.user,
        userlist:userlist,
            error_msg:'Something is wrong please try later'
        })
       })
   }
   
   
});
router.post('/addnewdepartment',ensureAuthenticated, async function(req, res) 
{
    const {departmentname} = req.body;
    const deptnames = await db.Department.findAll({});
     console.log("iwansheredept");
     console.log(departmentname);
    let errors = [];
 
    if (!departmentname){
        errors.push({ msg: 'Please add all required fields' });
       
    }
 
   if(errors.length >0){
    res.render('addusercredential',{
        errors,
        deptnames:deptnames,
      user :req.user
    })
   }
   else{
    db.Department.findOne({where:{
        name:departmentname,
        
       }}).then(user =>{
           if(user)
           {

            res.render('createdepartment',{
             
                error_msg:'This department name is already registered please change',
                deptnames:deptnames,
                user:req.user,
            })
           }
           else
           {
   
            db.Department.create({
                name:departmentname
            }).then(user =>{
                if(!user){
                 res.render('createdepartment',{
                   
                     error_msg:'Something is wrong while saving data please try later',
                     deptnames:deptnames,
                     user:req.user,
                 })
                }
                 res.render('createdepartment',{  
     
                     success_msg:'Your are successfully registered new  department',
                     deptnames:deptnames,
                     user:req.user,
                 })
             }).catch(error =>{
                 res.render('createdepartment',{
                   
                     error_msg:'Something is wrong while saving data please try later',
                     deptnames:deptnames,
                     user:req.user,
                 })
             })


           }
       }).catch(error =>{
           console.log(error)
        res.render('createdepartment',{
            deptnames,user:req.user,
            error_msg:'Something is wrong please try later'
        })
       })
   }
   
   
});
router.get('/updateUserStatus/:userId',ensureAuthenticated, async (req, res) => {
    const { userId } = req.params;

    try {
        // Find the user by user_id
        const user = await db.User.findOne({ where: { user_id: userId } });

        if (!user) {
            return res.status(404).send('User not found');
        }

        // Toggle user status (if 'Yes' -> 'No', if 'No' -> 'Yes')
        const newStatus = user.is_active === 'Yes' ? 'No' : 'Yes';

        // Update user status
        await db.User.update({ is_active: newStatus }, { where: { user_id: userId } });

        // Respond or redirect (depending on your flow)
        res.redirect('/selamcdms/createuser');  // Redirect back to the users page or dashboard
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while updating user status');
    }
});

  router.post('/updateuser',ensureAuthenticated, async (req, res) => {
    const { userId, username, password, userroll, department, fullname } = req.body;
   console.log(req.body);
    try {
      // Check if all required fields are present
      if (!userId || !username || !password || !userroll || !department || !fullname) {
        return res.status(400).send('All fields are required.');
      }
  
      // Find the user by userId
      const user = await db.User.findOne({ where: { user_id: userId } });
  
      if (!user) {
        return res.status(404).send('User not found');
      }

      // Save the updated user
      await db.User.update({
        username : username,
        password : await bcrypt.hash(password, 10),
        user_roll : userroll,
        department : department,
        fullname : fullname,

      },{where:{user_id:userId}})
  
      // Send response
      res.status(200).send('User updated successfully');
    } catch (error) {
      console.error(error);
      res.status(500).send('An error occurred while updating the user');
    }
  });
  
// Assuming you are using Express
router.post('/updatedepartment',ensureAuthenticated, async (req, res) => {
    const { id, name } = req.body;
  
    try {
      // Find the department by ID and update its name
      const department = await db.Department.findOne({ where: { id: parseInt(id) } });
  
      if (!department) {
        return res.status(404).json({ success: false, message: 'Department not found' });
      }
  
   
      await db.Department.update({name:name},{where:{id:parseInt(id)}});
  
      res.json({ success: true, message: 'Department updated successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'An error occurred while updating the department' });
    }
  });
  

module.exports = router;
