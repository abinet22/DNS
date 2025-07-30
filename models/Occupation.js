module.exports = (sequelize, DataTypes) => {
    const Occupation = sequelize.define('Occupation', {
      departmentid: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
       occupationname: {
        type: DataTypes.STRING,
        allowNull: false
      },
       synced: {
      type: DataTypes.BOOLEAN,
      defaultValue: false, // Default value is false
    },
    });
  
  
    return Occupation;
  };
  