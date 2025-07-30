module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define("User", {
    user_id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
      unique: true
    },
    fullname: {
      type: DataTypes.STRING,
    },
       synced: {
      type: DataTypes.BOOLEAN,
      defaultValue: false, // Default value is false
    },
    department: {
      type: DataTypes.STRING,
    },
    username: {
      type: DataTypes.STRING,
    },
    password: {
      type: DataTypes.STRING,
    },
    user_roll: {
      type: DataTypes.STRING,
    },
    is_active: {
      type: DataTypes.STRING,
    }
  }, {
    indexes: [
      {
        unique: true,
        fields: ['user_id']
      }
    ]
  });

  User.associate = models => {
    User.belongsToMany(models.File, {
      through: models.SharedFile,
      foreignKey: 'userId',
    });
    User.belongsToMany(models.Folder, {
      through: models.SharedFolder,
      foreignKey: 'userId',
    });
  };

  return User;
};
