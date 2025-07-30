const express = require('express');
const router = express.Router();

const db = require('../models');

const path = require("path");
const fs = require('fs');
const { Op, where } = require("sequelize");
const bcrypt = require('bcryptjs');
const passport = require('passport');
const { v4: uuidv4 } = require('uuid');
const { ensureAuthenticated, forwardAuthenticated } = require('../config/auth');
const upload =  require('../middleware/upload');
const archiver = require('archiver');

// Define the route for 'Manage File'
router.get('/managefile', ensureAuthenticated, async (req, res) => {
  res.render('managefile',{user:req.user});  // Ensure 'managefile' is the correct view file
});
router.get('/createreference', ensureAuthenticated, async (req, res) => {
  const occupations = await db.Occupation.findAll({ });
  const departments = await db.Department.findAll({ where: { is_dept: "Yes" } });
  const references = await db.BReference.findAll({ });
  res.render('createreference',{user:req.user,occupations,departments,references});  // Ensure 'managefile' is the correct view file
});
router.post('/add-reference', ensureAuthenticated,upload.single('fileUpload'), async (req, res) => {
  try {
    const {
      occupationid,
      level,
      type,
      title,
      link,
      synced
    } = req.body;

    let filePath = null;
    if (req.file) {
      filePath = `/uploads/${req.file.filename}`;
      
    }
  console.log("filePath");
  console.log(filePath);
    await db.BReference.create({
      occupationid,
      level,
      type,
      title,
      path: filePath,
      link,
      synced: synced === 'on'
    });

    // After success, fetch latest data and re-render the same page
    const occupations = await db.Occupation.findAll();
    const departments = await db.Department.findAll({ where: { is_dept: "Yes" } });
    const references = await db.BReference.findAll();

    res.render('createreference', {
      user: req.user,
      occupations,
      departments,
      references,
      success: 'Reference saved successfully!',
      error: null
    });

  } catch (error) {
    console.error('Error saving reference:', error);

    const occupations = await db.Occupation.findAll();
    const departments = await db.Department.findAll({ where: { is_dept: "Yes" } });
    const references = await db.BReference.findAll();

    res.render('createreference', {
      user: req.user,
      occupations,
      departments,
      references,
      success: null,
      error: 'Failed to save reference. Please check your input.'
    });
  }
});

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
  const files  =  await db.File.findAll({where:{folderId:1}});
  const filecount  =  await db.File.count({where:{folderId:1}});
  const foldercount =  await db.Folder.count({where:{parentFolderId:1}});
  const userlist = await db.User.findAll({});
  const navlocator = "Main ";
  res.render('managefolder',{user:req.user,folders,files,partnerid:1,folderid:1,
    foldercount,filecount,navlocator,userlist
  })
}
);
router.get('/subfolder/(:folderId)', ensureAuthenticated,async function (req, res) 
{
if(req.user){
  const [folders,fm] = await db.sequelize.query(`
   SELECT 
    f.id AS id,
    f.name AS name,
    COUNT(fi.fileId) AS fileCount,
    COUNT(sf.id) AS subfolderCount
FROM 
    Folders f
LEFT JOIN 
    Files fi ON f.id = fi.folderId  -- Count files in the folder
LEFT JOIN 
    Folders sf ON f.id = sf.parentFolderId  -- Count subfolders (child folders)
WHERE 
    f.parentFolderId = ${req.params.folderId}
GROUP BY 
    f.id
ORDER BY 
    f.name ASC;
    `)
  const files  =  await db.File.findAll({where:{folderId:req.params.folderId},order: [
    ['fileName', 'ASC'], // You can change 'ASC' to 'DESC' if you want descending order
  ],});
  const filecount  =  await db.File.count({where:{folderId:req.params.folderId}});
  const foldercount =  await db.Folder.count({where:{parentFolderId:req.params.folderId}});
  const foldercurrent =  await db.Folder.findOne({where:{id:req.params.folderId}});
  const partnerfolder =  await db.Folder.findOne({where:{id:foldercurrent.parentFolderId}});
// Assuming folder.id and partnerfolder.name are available in your context
const navlocator = "Main /" + (partnerfolder.id === 1000000
  ? "" 
  : `<a href="/selamcdms/filemanagement/subfolder/${partnerfolder.id}">${partnerfolder.name}</a>/`)  + foldercurrent.name;

  const userlist = await db.User.findAll({});
  res.render('managefolder',{user:req.user,folders,files,partnerid:req.params.folderId,folderid:req.params.folderId,
    foldercount,filecount,navlocator,userlist
  })
}
}
);

router.post('/share-folder',ensureAuthenticated,         async (req, res) => {
  try {
    const { folderId, users } = req.body; // Get folder ID and selected users

    // Ensure 'users' is always an array, even if it's just one user
    const userList = Array.isArray(users) ? users : [users];
    console.log("sharefolder");
    console.log(req.body);
    // Iterate over each user and check if the folder is already shared with the user
    for (let userId of userList) {
      console.log("sharefolderuserid");
      console.log(userId);
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

router.post('/share-files', ensureAuthenticated,async (req, res) => {
  console.log('Request body:', req.body);

  try {
    const { fileIds, users } = req.body; // Get selected file IDs and user IDs

    // Check if fileIds and users are provided
    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return res.status(400).json({ error_msg: "No files selected." });
    }

    if (!users || !Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ error_msg: "No users selected." });
    }

    // Iterate over each file and user to create share combinations
    for (let fileId of fileIds) {
      for (let userId of users) {
        // Check if this combination of fileId and userId already exists in the SharedFile table
        const existingShare = await db.SharedFile.findOne({
          where: {
            fileId: fileId,
            userId: userId
          }
        });

        if (!existingShare) {
          // If the file-user combination is not already shared, create a new entry
          await db.SharedFile.create({
            fileId: fileId,
            userId: userId
          });
        }
      }
    }

    // Respond with success message
    res.status(200).json({ success_msg: "Files shared successfully!" });
  } catch (error) {
    console.log("Error sharing files:", error);
    res.status(500).json({ error_msg: "Server error while sharing files." });
  }
});

router.get('/downloadselecteduploads', ensureAuthenticated, async function (req, res) {
  const { selectedFileIds } = req.query; // Read selected file IDs from query parameters

  if (!selectedFileIds || selectedFileIds.length === 0) {
    return res.status(400).send("No files selected for download.");
  }

  try {
    // Parse the selectedFileIds if they come as a string (due to URL encoding)
    const fileIds = Array.isArray(selectedFileIds) ? selectedFileIds : selectedFileIds.split(',');

    // Define the zip filename with current timestamp
    const now = new Date();
    const zipFilename = `SelamCDMS_Files_BackUp_DateOn-${now.toISOString().replace(/:/g, '-')}.zip`;
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

    // Fetch the selected files from the database
    const files = await db.File.findAll({
      where: {
        fileId: fileIds, // Filter by the selected file IDs
      }
    });

    if (files.length === 0) {
      return res.status(404).send("No files found with the given IDs.");
    }

    // Add the selected files to the zip archive
    files.forEach(file => {
      const filePath = path.join(__dirname, '../public', file.filePath);
      if (fs.existsSync(filePath)) {
        archive.append(fs.createReadStream(filePath), { name: file.fileName });
      } else {
        console.log(`File not found: ${filePath}`);
      }
    });

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

router.get('/searchfile', ensureAuthenticated,async (req, res) =>
{
  if(req.user){
    const folders  =  await db.Folder.findAll({where:{parentFolderId:1}});
  const files  =  await db.File.findAll();
  const filecount  =  await db.File.count({where:{folderId:1}});
  const foldercount =  await db.Folder.count({where:{parentFolderId:1}});
  const navlocator = "Search File ";
  const userlist = await db.User.findAll({});
  res.render('searchfile',{user:req.user,folders,files,partnerid:1,folderid:1,
    foldercount,filecount,navlocator,userlist
  })
  }
}
);
router.get('/searchfolder', ensureAuthenticated, async (req, res) => 
{
  const [folders,fm]  =  await db.sequelize.query(`
 select name,id,parentFolderId,count(fileId) as nooffile from Folders inner join Files on folderId =id
 group by name,id,parentFolderId
 order by id;
    `)

    if(req.user){
      const files  =  await db.File.findAll({where:{folderId:1}});
      const filecount  =  await db.File.count({where:{folderId:1}});
      const foldercount =  await db.Folder.count({where:{parentFolderId:1}});
      const userlist = await db.User.findAll({});
      const navlocator = "Search Folder ";
      res.render('searchfolder',{user:req.user,folders,files,partnerid:1,folderid:1,
        foldercount,filecount,navlocator,userlist
      })
    }
 
}
);
router.post('/renamefile', ensureAuthenticated, async (req, res) => {
  const { fileId, newFileName, fileExtension } = req.body;

  if (!fileId || !newFileName || !fileExtension) {
    return res.status(400).json({ error_msg: 'Missing parameters.' });
  }

  try {
    // Find the file in the database
    const file = await db.File.findOne({ where: { fileId } });

    if (!file) {
      return res.status(404).json({ error_msg: 'File not found.' });
    }

    // Construct the old and new file paths
    const oldFilePath = path.join(__dirname, '../public', file.filePath);  // Get the full old file path
    const newFileNameWithExtension = `${newFileName}.${fileExtension}`;  // New file name with extension
    const newFilePath = path.join(__dirname, '../public', file.filePath.replace(file.fileName, newFileNameWithExtension)); // Same path, different file name

    // Rename the file on the server (just the name, not the path)
    fs.rename(oldFilePath, newFilePath, async (err) => {
      if (err) {
        console.error('Error renaming file:', err);
        return res.status(500).json({ error_msg: 'An error occurred while renaming the file.' });
      }

      // Update the file name in the database (just the name, not the path)
      await db.File.update(
        { fileName: newFileNameWithExtension, filePath: file.filePath.replace(file.fileName, newFileNameWithExtension) },
        { where: { fileId } }
      );

      res.status(200).json({ message: 'File successfully renamed' });
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error_msg: 'An error occurred while renaming the file.' });
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
  
  router.post('/deletefile/:fileId', ensureAuthenticated, async (req, res) => {
    const { fileId } = req.params;
  
    try {
      // Find the file by fileId
      const file = await db.File.findOne({ where: { fileId: fileId } });
  
      if (!file) {
        return res.status(404).send('File not found');
      }
  
      // Delete rows in the sharedfiles table that reference this fileId
      await db.SharedFile.destroy({ where: { fileId: fileId } });
  
      // Now, delete the file from the files table
      await db.File.destroy({ where: { fileId: fileId } });
  
      res.status(200).json({ message: 'File successfully deleted' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'An error occurred while deleting the file' });
    }
  });
  router.post('/deleteselectedfiles', ensureAuthenticated, async (req, res) => {
    const { selectedFileIds } = req.body;  // Get the selected file IDs from the request body
  
    if (!selectedFileIds || selectedFileIds.length === 0) {
      return res.status(400).json({ message: 'No files selected for deletion.' });
    }
  
    try {
      // Delete rows in the sharedfiles table that reference the selected fileIds
      await db.SharedFile.destroy({
        where: {
          fileId: selectedFileIds,
        },
      });
  
      // Delete the files from the files table
      await db.File.destroy({
        where: {
          fileId: selectedFileIds,
        },
      });
  
      res.status(200).json({ message: 'Files successfully deleted' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'An error occurred while deleting the files' });
    }
  });
  
  router.get('/deletefolder/:folderId', ensureAuthenticated, async (req, res) => {
    const { folderId } = req.params;
    const folders  =  await db.Folder.findAll({where:{parentFolderId:1}});
    const files  =  await db.File.findAll({where:{folderId:1}});
    const filecount  =  await db.File.count({where:{folderId:1}});
    const foldercount =  await db.Folder.count({where:{parentFolderId:1}});
    const userlist = await db.User.findAll({});
    const navlocator = "Main ";
    try {
      const folder = await db.Folder.findOne({ where: { id: folderId } });
  
      // Find the file by fileId
      if (!folderId) {
        return   res.render('managefolder',{user:req.user,folders,files,partnerid:1,folderid:1,
          foldercount,filecount,navlocator,userlist,
          error_msg:'An error occurred while deleting the folder'
        })
      }
      if (!folder) {
        return   res.render('managefolder',{user:req.user,folders,files,partnerid:1,folderid:1,
          foldercount,filecount,navlocator,userlist,
          error_msg:'An error occurred while deleting the folder'
        })
      }
      
    await db.File.update({ folderId: 1 }, { where: { folderId: folderId } });
   
      await db.SharedFolder.destroy({ where: { folderId: folderId } });
     await db.Folder.destroy({ where: { id: folderId } });
  
      res.render('managefolder',{user:req.user,folders,files,partnerid:1,folderid:1,
        foldercount,filecount,navlocator,userlist,
        success_msg:'Folder successfully deleted'
      })
    } catch (error) {
   
      res.render('managefolder',{user:req.user,folders,files,partnerid:1,folderid:1,
        foldercount,filecount,navlocator,userlist,
        error_msg:'An error occurred while deleting the folder'
      })
    }
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
  router.post('/updatefolder', (req, res) => {
    const folderId = req.body.folderId;
    const folderName = req.body.folderName;
  
    if (!folderId || !folderName) {
      return res.json({ success: false, error: 'Folder ID and Name are required.' });
    }
  
    // Example database update (assuming you are using an ORM like Sequelize or Mongoose)
    db.Folder.update({ name: folderName }, { where: { id: folderId } })
      .then(updated => {
        if (updated[0] > 0) {
          // Folder updated successfully
          return res.json({ success: true });
        } else {
          // Folder not found or no changes
          return res.json({ success: false, error: 'Folder not found or no changes made.' });
        }
      })
      .catch(error => {
        console.error(error);
        return res.json({ success: false, error: 'An error occurred while updating the folder.' });
      });
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
module.exports = router;
