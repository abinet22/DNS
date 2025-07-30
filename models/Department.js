module.exports = (sequelize, DataTypes) => {
    const Department = sequelize.define('Department', {
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      is_dept:{
        type: DataTypes.STRING,
      
      },
       synced: {
      type: DataTypes.BOOLEAN,
      defaultValue: false, // Default value is false
    },
    });
  
  
    return Department;
  };
  