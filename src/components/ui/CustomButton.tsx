import React from "react";

export const CustomButton = ({ title, onClick, className , icon = null }) => {
  return (
    <button onClick={onClick} className={className}>
      {icon && <span className="mr-2">{icon}</span>}
      {title}
    </button>
  );
};
