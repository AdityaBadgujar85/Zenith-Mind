import React, { useEffect, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { Container, Navbar, Nav, Dropdown } from "react-bootstrap";
import { FaUserCircle } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import classes from "./NavBar.module.css";

function NavBar() {
  const navigate = useNavigate();

  const readUser = () => {
    try {
      const u = localStorage.getItem("user");
      const token =
        localStorage.getItem("auth_token") || localStorage.getItem("token");
      if (!token) return { isLoggedIn: false, name: "", email: "" };
      const parsed = u ? JSON.parse(u) : {};
      return {
        isLoggedIn: true,
        name: parsed?.name || parsed?.username || "User",
        email: parsed?.email || "",
      };
    } catch {
      return { isLoggedIn: false, name: "", email: "" };
    }
  };

  const [user, setUser] = useState(readUser);

  useEffect(() => {
    const updateUser = () => setUser(readUser());
    window.addEventListener("storage", updateUser);
    window.addEventListener("userLogin", updateUser);
    return () => {
      window.removeEventListener("storage", updateUser);
      window.removeEventListener("userLogin", updateUser);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser({ isLoggedIn: false, name: "", email: "" });
    navigate("/login", { replace: true });
  };

  return (
    <Navbar fixed="top" expand="lg" className={`shadow ${classes["Navbar-Design"]}`}>
      <Container>
        <Navbar.Brand href="/">
          <h1 className={classes["Navbar-Brand"]}>ZenithMind</h1>
        </Navbar.Brand>

        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="ms-auto align-items-center">
            <Nav.Link className={classes["Navlink-text"]} href="/">Home</Nav.Link>
            <Nav.Link className={classes["Navlink-text"]} href="/about">About</Nav.Link>
            <Nav.Link className={classes["Navlink-text"]} href="/contact">Contact</Nav.Link>

            <Dropdown style={{ marginLeft: "2rem" }}>
              <Dropdown.Toggle
                variant="transparent"
                id="dropdown-user"
                className={classes["UserIcon"]}
              >
                <FaUserCircle size={28} color="#2f3e46" />
              </Dropdown.Toggle>

              <Dropdown.Menu className={classes["UserDropdown"]}>
                {user.isLoggedIn ? (
                  <>
                    <div className={classes["UserInfo"]}>
                      <div className={classes["UserName"]}>{user.name}</div>
                      <div className={classes["UserEmail"]}>{user.email}</div>
                    </div>
                    <Dropdown.Divider />
                    <Dropdown.Item onClick={handleLogout}>Logout</Dropdown.Item>
                  </>
                ) : (
                  <>
                    <Dropdown.Item href="/login">Login</Dropdown.Item>
                    <Dropdown.Item href="/signup">Sign Up</Dropdown.Item>
                  </>
                )}
              </Dropdown.Menu>
            </Dropdown>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default NavBar;
