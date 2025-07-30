module.exports = (sequelize, DataTypes) => {
  const Folder = sequelize.define('Folder', {
      name: {
          type: DataTypes.STRING,
          allowNull: false
      },
      parentFolderId: {
          type: DataTypes.INTEGER,
          allowNull: true,
      },
         synced: {
      type: DataTypes.BOOLEAN,
      defaultValue: false, // Default value is false
    },
  });

  Folder.associate = (models) => {
      // A folder can have many files (1-to-many relationship)
      Folder.hasMany(models.File, { foreignKey: 'folderId' });

      // A folder can have many subfolders (self-referencing 1-to-many relationship)
      Folder.hasMany(Folder, { foreignKey: 'parentFolderId', as: 'Subfolders' });  // Alias 'Subfolders' for clarity

      // A folder belongs to another folder (parent-child relationship, self-referencing)
      Folder.belongsTo(Folder, { foreignKey: 'parentFolderId', as: 'ParentFolder' });

      // A folder can be shared by many users, and a user can access many folders through the SharedFolder join table
      Folder.belongsToMany(models.User, {
          through: models.SharedFolder,
          foreignKey: 'folder_id',
      });
  };

  return Folder;
};
