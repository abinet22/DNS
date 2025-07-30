module.exports = (sequelize, DataTypes) => {
  const File = sequelize.define('File', {
    fileId: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true,  // Sets fileId as the primary key
    },
    fileName: {
      type: DataTypes.STRING,
      allowNull: false,  // Ensures file name is provided
    },
       synced: {
      type: DataTypes.BOOLEAN,
      defaultValue: false, // Default value is false
    },
    filePath: {
      type: DataTypes.STRING,
      allowNull: false,  // Ensures file path is provided
    },
    description: {
      type: DataTypes.STRING,  // Optional field for file description
    },
    folderId: {
      type: DataTypes.INTEGER,
      allowNull: false,  // Ensures each file is linked to a folder
    }
  });

  File.associate = models => {
    // One file belongs to one folder
    File.belongsTo(models.Folder, { foreignKey: 'folderId' });
  };

  return File;
};
