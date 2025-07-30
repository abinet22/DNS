const express = require('express');
const router = express.Router();
const db = require('../models'); // Adjust path to your models 
const sequelize = db.sequelize ;
const { Op } = require("sequelize");


router.get('/', async (req, res) => {
  const files = await db.File.findAll({ limit: 3, order: [['createdAt', 'DESC']] });
  res.render('elibrary/index', { files });
});

router.get('/file/:id', async (req, res) => {
  const file = await db.File.findByPk(req.params.id);
  res.render('elibrary/file', { file });
});


router.get('/category/study-materials', async (req, res) => {
  const departments = await db.Department.findAll({where: { id:26 } });
  res.render('elibrary/category-study-materials', { departments });
});
router.get('/category/references', async (req, res) => {
  const departments = await db.Department.findAll({where: { is_dept: "Yes" } });
  const [rows] = await db.sequelize.query(`
  SELECT 
    d.id AS departmentId,
    d.name AS departmentName,
    o.id AS occupationId,
    o.occupationname AS occupationName,
    r.id AS referenceId,
    r.level AS referenceLevel,
    r.type AS referenceType,
    r.title AS referenceTitle,
    r.path AS referencePath,
    r.link AS referenceLink
  FROM Departments d
  JOIN Occupations o ON o.departmentid = d.id
  JOIN BReferences  r ON r.occupationid = o.id
  ORDER BY d.id, o.id, r.level
`);
const referenceData = [];

rows.forEach(row => {
  // Find or create department
  let department = referenceData.find(d => d.id === row.departmentId);
  if (!department) {
    department = {
      id: row.departmentId,
      name: row.departmentName,
      occupations: []
    };
    referenceData.push(department);
  }

  // Find or create occupation
  let occupation = department.occupations.find(o => o.id === row.occupationId);
  if (!occupation) {
    occupation = {
      id: row.occupationId,
      name: row.occupationName,
      levels: []
    };
    department.occupations.push(occupation);
  }

  const levelId = parseInt(row.referenceLevel);
  let level = occupation.levels.find(l => l.id === levelId);
  if (!level) {
    level = {
      id: levelId,
      name: `Level ${levelId}`,
      references: []
    };
    occupation.levels.push(level);
  }

  level.references.push({
    type: row.referenceType,
    title: row.referenceTitle,
    path: row.referencePath || undefined,
    videoId: row.referenceLink || undefined,
    info: getReferenceInfo(row)
  });
});
function getReferenceInfo(row) {
  if (row.referenceType === 'file') {
    const ext = row.referencePath?.split('.').pop()?.toUpperCase();
    return `${ext || 'File'}`;
  }
  if (row.referenceType === 'video') {
    return 'Video'; // Or you could call YouTube API to get duration
  }
  return '';
}
console.log(referenceData);
  res.render('elibrary/category-references', { departments,referenceData });
});
router.get('/study-materials/:departmentId', async (req, res) => {
  const departmentId = req.params.departmentId;

  // Fetch department name
  const dept = await db.Department.findOne({ where: { id: 26 } });

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
router.get('/study-materials/subfolder/:folderId', async (req, res) => {
  const folderId = req.params.folderId;
 const userId = '4cfe7048-b753-432c-9b31-9a8a034be1f3';
  // Fetch subfolders using raw SQL

  const [subFolders,fm] = await db.sequelize.query(
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
           const [files,ffm] = await db.sequelize.query(
                  `SELECT Files.* 
                   FROM Files 
                   INNER JOIN SharedFiles ON Files.fileId = SharedFiles.fileId 
                   WHERE Files.folderId = ${folderId}  AND SharedFiles.userId = '${userId}'
                      order by fileName
                   `,
                
                );
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
router.get('/folder/:folderId', async (req, res) => {
  const folderId = req.params.folderId;

  // Fetch subfolders using raw SQL
  const [subFolders] = await sequelize.query(`
    SELECT DISTINCT f.id, f.name
    FROM Folders f
    WHERE f.parentFolderId = ${folderId}
    ORDER BY f.name ASC;
  `);

  // Fetch files using raw SQL
  const [files] = await sequelize.query(`
    SELECT DISTINCT fi.fileId, fi.fileName, fi.filePath
    FROM Files fi
    WHERE fi.folderId = ${folderId}
    ORDER BY fi.fileName ASC;
  `);

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