module.exports = (sequelize, DataTypes) => {
  const SharedFile = sequelize.define('SharedFile', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    fileId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'Files', // references Files table
        key: 'fileId'
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

  SharedFile.associate = models => {
    // Associations with File and User models
    SharedFile.belongsTo(models.File, { foreignKey: 'fileId' });
    SharedFile.belongsTo(models.User, { foreignKey: 'userId' });
  };

  return SharedFile;
};
