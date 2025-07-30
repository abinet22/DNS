module.exports = (sequelize, DataTypes) => {
    const SharedFolder = sequelize.define('SharedFolder', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      folderId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'Folders', // references Folders table
          key: 'id'
        }
      },
      userId: {
        type: DataTypes.STRING,
        allowNull: false,
        references: {
          model: 'Users', // references Users table
          key: 'user_id'
        }
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    SharedFolder.associate = models => {
      // Associations with User and Folder models
      SharedFolder.belongsTo(models.Folder, { foreignKey: 'folderId' });
      SharedFolder.belongsTo(models.User, { foreignKey: 'userId' });
    };

    return SharedFolder;
};
