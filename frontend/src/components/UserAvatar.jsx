import { useState, useEffect } from 'react';
import { NavLink } from 'react-router';
import { useSelector, useDispatch } from 'react-redux';
import { logoutUser } from '../authSlice';
import axiosClient from '../utils/axiosClient';

function UserAvatar() {
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const [img, setImg] = useState(null);

  useEffect(() => {
    axiosClient.get('/user/check')
      .then(({ data }) => setImg(data.user?.profileImageUrl))
      .catch(() => {});
  }, []);

  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase() || 'U';

  return (
    <div className="dropdown dropdown-end">
      <div tabIndex={0} role="button" className="cursor-pointer">
        {img ? (
          <img src={img} alt="Profile"
            className="w-9 h-9 rounded-full object-cover ring-2 ring-base-300 hover:ring-primary transition" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-primary text-primary-content flex items-center justify-center text-sm font-semibold ring-2 ring-base-300 hover:ring-primary transition">
            {initials}
          </div>
        )}
      </div>
      <ul tabIndex={0} className="dropdown-content menu bg-base-100 rounded-box shadow-lg z-10 w-44 p-2 mt-2">
        <li className="menu-title text-xs">{user?.firstName} {user?.lastName || ''}</li>
        <li><NavLink to="/profile">Profile</NavLink></li>
        <li><button onClick={() => dispatch(logoutUser())}>Logout</button></li>
      </ul>
    </div>
  );
}

export default UserAvatar;