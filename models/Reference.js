module.exports = (sequelize, DataTypes) => {
    const BReference = sequelize.define('BReference', {
      level: {
        type: DataTypes.STRING,
        allowNull: false
      },
       occupationid: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      type: {
        type: DataTypes.STRING,
      },
      title:{
        type: DataTypes.STRING,
        allowNull: false
      },
      path:{
     type: DataTypes.STRING,
      },
      link:{
     type: DataTypes.STRING,
      },

       synced: {
      type: DataTypes.BOOLEAN,
      defaultValue: false, // Default value is false
    },
    });
  
  
    return BReference;
  };
  