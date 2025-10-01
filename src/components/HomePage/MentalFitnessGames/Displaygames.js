import React from 'react';
import { Outlet } from 'react-router-dom';

function Displaygames() {
    return ( 
        <div>
            <Outlet />
        </div>
     );
}

export default Displaygames;
