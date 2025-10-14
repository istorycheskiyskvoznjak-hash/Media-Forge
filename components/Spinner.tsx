
import React from 'react';

const Spinner: React.FC<{ size?: string }> = ({ size = "h-8 w-8" }) => {
    return (
        <div className="flex justify-center items-center">
            <div className={`animate-spin rounded-full border-b-2 border-purple-400 ${size}`}></div>
        </div>
    );
};

export default Spinner;