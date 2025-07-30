const express = require('express');
const router = express.Router();

const db = require('../models');


const { Op, where } = require("sequelize");
const bcrypt = require('bcryptjs');
const passport = require('passport');
const { v4: uuidv4 } = require('uuid');
const { ensureAuthenticated, forwardAuthenticated } = require('../config/auth');
const upload =  require('../middleware/upload');
const sequelize = db.sequelize ;

router.get('/managefolder', ensureAuthenticated,async function (req, res) 
{
  const folders = await db.Folder.findAll({
    where: {
      parentFolderId: 1000000,
      id: {
        [Op.ne]: 1000000, // This uses Sequelize's "not equal" operator
      },
    },
  });
  const files  =  await db.File.findAll({where:{folderId:0}});
  const filecount  =  await db.File.count({where:{folderId:1}});
  const foldercount =  await db.Folder.count({where:{parentFolderId:1}});
  const userlist = await db.User.findAll({});
  const navlocator = "Main ";
  res.render('managefolderuser',{user:req.user,folders,files,partnerid:1,folderid:1,
    foldercount,filecount,navlocator,userlist
  })
}
);
router.get('/subfolder/:folderId', ensureAuthenticated, async function (req, res) {
    try {
      if (req.user) {
        const userId = req.user.user_id;
        const folderId = req.params.folderId;
  
        // Fetch only shared folders that belong to the current user
        const [folders,fm] = await db.sequelize.query(
          `
          SELECT Folders.*, 
          IFNULL(COUNT(DISTINCT Files.fileId), 0) AS fileCount,
          IFNULL(COUNT(DISTINCT SubFolders.id), 0) AS subFolderCount
   FROM Folders
   LEFT JOIN Files ON Folders.id = Files.folderId
   LEFT JOIN Folders AS SubFolders ON Folders.id = SubFolders.parentFolderId
   INNER JOIN SharedFolders ON Folders.id = SharedFolders.folderId
   WHERE Folders.parentFolderId = ${folderId} 
     AND SharedFolders.userId = '${userId}'
   GROUP BY Folders.id
   ORDER BY Folders.name
           `
           
        );
  
        // Fetch only shared files that belong to the current user
        const [files,ffm] = await db.sequelize.query(
          `SELECT Files.* 
           FROM Files 
           INNER JOIN SharedFiles ON Files.fileId = SharedFiles.fileId 
           WHERE Files.folderId = ${folderId}  AND SharedFiles.userId = '${userId}'
              order by fileName
           `,
        
        );
  
        // Get folder and file counts
        const filecount = files.length;
        const foldercount = folders.length;
  
        // Get current folder details
        const foldercurrent = await db.Folder.findOne({ where: { id: folderId } });
  
        // Get parent folder details
        let navlocator = "Main";
        if (foldercurrent && foldercurrent.parentFolderId) {
           const partnerfolder = await db.Folder.findOne({ where: { id: foldercurrent.parentFolderId } });
          // navlocator = `Main / ${partnerfolder ? partnerfolder.name : ''} / ${foldercurrent.name}`;
           navlocator = "Main /" + (partnerfolder.id === 1000000
            ? "" 
            : `<a href="/selamcdms/cdmsusers/subfolder/${partnerfolder.id}">${partnerfolder.name}</a>/`)  + foldercurrent.name;
          
        }
         const userlist = await db.User.findAll({});
        res.render('managefolderuser', {
          user: req.user,
          folders,
          files,
          userlist,
          partnerid: folderId,
          folderid: folderId,
          foldercount,
          filecount,
          navlocator
        });
      }
    } catch (error) {
      console.error("Error fetching shared folders and files:", error);
      res.status(500).send("Internal Server Error");
    }
  });
  

router.post("/share-folder", async (req, res) => {
  try {
    const { folderId, users } = req.body; // Get folder ID and selected users

    // Iterate over each user and check if the folder is already shared with the user
    for (let userId of users) {
      // Check if the folder is already shared with the user
      const existingShare = await db.SharedFolder.findOne({
        where: {
          folderId: parseInt(folderId),
          userId: userId
        }
      });

      if (!existingShare) {
        // If not shared, create a new shared folder entry
        await db.SharedFolder.create({
          folderId: folderId,
          userId: userId
        });
      }
    }

    res.status(200).json({ message: "Folder shared successfully!" });
  } catch (error) {
    console.error("Error sharing folder:", error);
    res.status(500).json({ error: "Server error while sharing folder." });
  }
});
router.post("/share-file", async (req, res) => {
  try {
    const { fileId, users } = req.body; // Get folder ID and selected users

    // Iterate over each user and check if the folder is already shared with the user
    for (let userId of users) {
      // Check if the folder is already shared with the user
      const existingShare = await db.SharedFile.findOne({
        where: {
          fileId: fileId,
          userId: userId
        }
      });

      if (!existingShare) {
        // If not shared, create a new shared folder entry
        await db.SharedFile.create({
          fileId: fileId,
          userId: userId
        });
      }
    }

    res.status(200).json({ message: "File shared successfully!" });
  } catch (error) {
    console.error("Error sharing folder:", error);
    res.status(500).json({ error: "Server error while sharing folder." });
  }
});


router.get('/searchfile', ensureAuthenticated,async (req, res) =>
{
  if(req.user){
    const userId = req.user.user_id;
    const folders  =  await db.Folder.findAll({where:{parentFolderId:1}});
    const [files,ffm] = await db.sequelize.query(
        `SELECT Files.* 
         FROM Files 
         INNER JOIN SharedFiles ON Files.fileId = SharedFiles.fileId 
         WHERE SharedFiles.userId = '${userId}'`,
      
      );
  const filecount  =  await db.File.count({where:{folderId:1}});
  const foldercount =  await db.Folder.count({where:{parentFolderId:1}});
  const navlocator = "Search File ";
  const userlist = await db.User.findAll({});
  res.render('searchfileuser',{user:req.user,folders,files,partnerid:1,folderid:1,
    foldercount,filecount,navlocator,userlist
  })
  }
}
);
router.get('/searchfolder', ensureAuthenticated, async (req, res) => 
{

    if(req.user){
        const userId = req.user.user_id;
              // Fetch only shared folders that belong to the current user
              const [folders,fm] = await db.sequelize.query(
                `
                  select name,Folders.id,parentFolderId,count(fileId) as nooffile from Folders 
                  
                  inner join Files on Files.folderId =Folders.id
 
                 INNER JOIN SharedFolders ON Folders.id = SharedFolders.folderId 
                 WHERE  SharedFolders.userId = '${userId}'
                  group by name,Folders.id,parentFolderId
                order by Folders.id;

                 `,
           
              );
      const files  =  await db.File.findAll({where:{folderId:1}});
      const filecount  =  await db.File.count({where:{folderId:1}});
      const foldercount =  await db.Folder.count({where:{parentFolderId:1}});
      const userlist = await db.User.findAll({});
      const navlocator = "Search Folder ";
      res.render('searchfolderuser',{user:req.user,folders,files,partnerid:1,folderid:1,
        foldercount,filecount,navlocator,userlist
      })
    }
 
}
);
router.post("/share-file", async (req, res) => {
  try {
    const { fileId, users } = req.body; // Get folder ID and selected users

    // Iterate over each user and check if the folder is already shared with the user
    for (let userId of users) {
      // Check if the folder is already shared with the user
      const existingShare = await db.SharedFile.findOne({
        where: {
          fileId: fileId,
          userId: userId
        }
      });

      if (!existingShare) {
        // If not shared, create a new shared folder entry
        await db.SharedFile.create({
          fileId: fileId,
          userId: userId
        });
      }
    }

    res.status(200).json({ message: "File shared successfully!" });
  } catch (error) {
    console.error("Error sharing folder:", error);
    res.status(500).json({ error: "Server error while sharing folder." });
  }
});
router.post('/upload', ensureAuthenticated, upload.array('files'), async (req, res) => {
  const files = req.files;
  const { folderId, description } = req.body;  // Get description and folderId from req.body
  const filePaths = [];

  // Use default folderId 1 if none is provided
  const targetFolderId = folderId ? parseInt(folderId) : 1;

  // Check if the folder exists (optional)
  const folder = await db.Folder.findOne({ where: { id: targetFolderId } });
  if (!folder) {
    return res.status(400).send('Folder not found.');
  }

  // Check if files are provided
  if (!files || files.length === 0) {
    return res.status(400).send('No files uploaded.');
  }

  // Process each file
  try {
    for (let file of files) {
      const filePath = `/uploads/${file.filename}`; // Store the path relative to the server
      filePaths.push(filePath);

      // Save file information into the database
      await db.File.create({
        fileId: uuidv4(),  // Generate a unique ID for the file
        fileName: file.originalname,
        filePath: filePath,
        folderId: targetFolderId, // Use the provided folderId or default to 1
        description: description, // Store the description
      });
    }

    console.log('Files uploaded successfully');
    res.status(200).send('Files uploaded successfully!');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error uploading files.');
  }
});

router.get('/files/:folderId',ensureAuthenticated, async (req, res) => {
    const { folderId } = req.params;
  
    // Find the folder and its subfolders (recursive search can be implemented here)
    const folder = await db.Folder.findByPk(folderId, {
      include: [
        {
          model: File
        },
        {
          model: db.Folder,
          as: 'subfolders'
        }
      ]
    });
  
    if (!folder) {
      return res.status(404).send('Folder not found');
    }
  
    res.json(folder);
  });
  
  // Example to create a folder
  router.post('/createFolder',ensureAuthenticated, async (req, res) => {
    const { folderName, parentFolderId } = req.body;
    console.log(req.body);
    // Ensure parentFolderId is either valid or null (for top-level folder)
    const targetFolderId = parentFolderId ? parseInt(parentFolderId) : 1;
  
    // Check if targetFolderId exists in the folders table (if it's not null)
    if (targetFolderId !== 1) {
      const parentFolder = await db.Folder.findOne({where:{id:targetFolderId}});
      if (!parentFolder) {
        return res.status(400).json({ error: 'Parent folder does not exist' });
      }
    }
  
    try {
      const newFolder = await db.Folder.create({
        name: folderName,
        parentFolderId: targetFolderId,
      });
      res.status(201).json(newFolder);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error creating folder' });
    }
  });
  
router.get('/getFiles',ensureAuthenticated,async  (req, res) => {

    const results  =  await db.File.findAll({});
    if (!results) {
        console.error('Error fetching files:', err);
        return res.status(500).send('Error fetching files from database.');
    }
    console.log(results)
    console.log("i was there")
    res.status(200).json(results);
});
router.get('/getFolders',ensureAuthenticated,async  (req, res) => {

    const results  =  await db.Folder.findAll({});
    if (!results) {
        console.error('Error fetching folders:', err);
        return res.status(500).send('Error fetching folders from database.');
    }
    console.log(results)
    console.log("i was there")
    res.status(200).json(results);
});
router.get('/findfolder/(:folderid)',ensureAuthenticated,async  (req, res) => {

    const results  =  await db.Folder.findAll({where:{parentFolderId:req.params.folderid}});
    const files = await db.File.findAll({
        where: { folderId: req.params.folderid }
    });
    if (!results) {
        console.error('Error fetching folders:', err);
        return res.status(500).send('Error fetching folders from database.');
    }
    console.log(results)
    console.log(req.params.folderid)
    console.log("i was there on sub folder")
    res.status(200).json({subfolders:results,files:files});
});
router.get('/shared-materials', ensureAuthenticated,async (req, res) => {
  const departments = await db.Department.findAll({ });
  res.render('usersearchfiles', { departments,user:req.user });
});

router.get('/study-materials/:departmentId',ensureAuthenticated, async (req, res) => {
  const departmentId = req.params.departmentId;

  // Fetch department name
  const dept = await db.Department.findOne({ where: { id: departmentId } });

  if (!dept) {
    return res.status(404).json({ error: 'Department not found' });
  }

  // Fetch users in the department
  const users = await db.User.findAll({ where: { department: dept.name } });
  const userIds = users.map(user => user.id);

  // Handle case where no users are found in the department
  if (userIds.length === 0) {
    return res.json({ folders: [] });
  }

  // Fetch main folders shared with these users using raw SQL
  const [mainFolders] = await sequelize.query(`
      SELECT DISTINCT f.id, f.name
    FROM Folders f

    WHERE f.parentFolderId = 1000000 AND f.id != 1000000
    ORDER BY f.name ASC;
  `);
 console.log(mainFolders);
  // Fetch files and subfolders for each main folder using raw SQL
  const folderData = await Promise.all(
    mainFolders.map(async folder => {
      const [subFolders] = await sequelize.query(`
        SELECT DISTINCT f.id, f.name
        FROM Folders f
        WHERE f.parentFolderId = ${folder.id}
        ORDER BY f.name ASC;
      `);

      const [files] = await sequelize.query(`
        SELECT DISTINCT fi.fileId, fi.fileName, fi.filePath
        FROM Files fi
        WHERE fi.folderId = ${folder.id}
        ORDER BY fi.fileName ASC;
      `);

      return {
        id: folder.id,
        name: folder.name,
        subFolders: subFolders.map(subFolder => ({
          id: subFolder.id,
          name: subFolder.name,
        })),
        files: files.map(file => ({
          id: file.filId,
          name: file.fileName,
          path: file.filePath,
        })),
      };
    })
  );

  res.json({ folders: folderData });
});
router.get('/study-materials/subfolder/:folderId',ensureAuthenticated, async (req, res) => {
  const folderId = req.params.folderId;
   const userId = req.user.user_id;
  
  
  // Fetch subfolders using raw SQL
  const [subFolders] = await sequelize.query(`
  
        SELECT DISTINCT f.id, f.name,
          IFNULL(COUNT(DISTINCT Files.fileId), 0) AS fileCount,
          IFNULL(COUNT(DISTINCT SubFolders.id), 0) AS subFolderCount
   FROM Folders f
   LEFT JOIN Files ON f.id = Files.folderId
   LEFT JOIN Folders AS SubFolders ON f.id = SubFolders.parentFolderId
   INNER JOIN SharedFolders ON f.id = SharedFolders.folderId
   WHERE f .parentFolderId = ${folderId} 
     AND SharedFolders.userId = '${userId}'
   GROUP BY f.id
   ORDER BY f.name ASC;
  `);

  // Fetch files using raw SQL
  const [files] = await sequelize.query(`

    SELECT DISTINCT fi.fileId, fi.fileName, fi.filePath
           FROM Files fi
           INNER JOIN SharedFiles ON fi.fileId = SharedFiles.fileId 
           WHERE fi.folderId = ${folderId}  AND SharedFiles.userId = '${userId}'
              order by fi.fileName ASC;
  `);
console.log(subFolders);
  console.log(files);
  res.json({
    subFolders: subFolders.map(subFolder => ({
      id: subFolder.id,
      name: subFolder.name,
    })),
    files: files.map(file => ({
      id: file.fileId,
      name: file.fileName,
      path: file.filePath,
    })),
  });
});
module.exports = router;
