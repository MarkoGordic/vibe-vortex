function toggleForms() {
    const loginContainer = document.getElementById('login-container');
    const registerContainer = document.getElementById('register-container');

    if (loginContainer.classList.contains('active-form')) {
        loginContainer.classList.remove('active-form');
        setTimeout(() => {
            loginContainer.style.display = 'none';
            registerContainer.style.display = 'flex';
            registerContainer.classList.add('active-form');
        }, 500);
    } else {
        registerContainer.classList.remove('active-form');
        setTimeout(() => {
            registerContainer.style.display = 'none';
            loginContainer.style.display = 'flex';
            loginContainer.classList.add('active-form');
        }, 500);
    }
}

function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    const eyeIcon = input.nextElementSibling.querySelector('i');

    if (input.type === "password") {
        input.type = "text";
        eyeIcon.classList.remove('fa-eye');
        eyeIcon.classList.add('fa-eye-slash');
    } else {
        input.type = "password";
        eyeIcon.classList.remove('fa-eye-slash');
        eyeIcon.classList.add('fa-eye');
    }
}

document.addEventListener('DOMContentLoaded', function () {
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginForm = document.querySelector('#login-container form');
    const alertMsg = document.querySelector('.alert-msg');

    const usernameInput = document.getElementById('username');
    const emailNewInput = document.getElementById('email-new');
    const passwordNewInput = document.getElementById('password-new');
    const passwordRepeatedInput = document.getElementById('password-repeated');
    const signUpForm = document.querySelector('#register-container form');
    const signUpAlertMsg = document.querySelector('.register-container .alert-msg');

    loginForm.addEventListener('submit', function (e) {
        const emailFilled = emailInput.value.trim() !== '';
        const passwordFilled = passwordInput.value.trim() !== '';

        if (!emailFilled || !passwordFilled) {
            e.preventDefault();
            alertMsg.textContent = 'Please fill in all fields.';
        }
    });

    signUpForm.addEventListener('submit', function (e) {
        const usernameFilled = usernameInput.value.trim() !== '';
        const emailNewFilled = emailNewInput.value.trim() !== '';
        const password = passwordNewInput.value;
        const passwordRepeatedValid = passwordRepeatedInput.value === password;

        let errorMessage = '';
        if (!usernameFilled || !emailNewFilled) {
            errorMessage = 'Please fill in all fields.';
        } else if (password.length < 10) {
            errorMessage = 'Password must be at least 10 characters long.';
        } else if (!password.match(/[a-z]/)) {
            errorMessage = 'Password must include a lowercase letter.';
        } else if (!password.match(/[A-Z]/)) {
            errorMessage = 'Password must include an uppercase letter.';
        } else if (!password.match(/\d/)) {
            errorMessage = 'Password must include a digit.';
        } else if (!password.match(/\W/)) {
            errorMessage = 'Password must include a symbol.';
        } else if (!passwordRepeatedValid) {
            errorMessage = 'Passwords do not match.';
        }

        if (errorMessage) {
            e.preventDefault();
            signUpAlertMsg.textContent = errorMessage;
        }
    });
});

document.addEventListener('DOMContentLoaded', function () {
    const params = new URLSearchParams(window.location.search);
    const info = params.get('info');
    const error = params.get('error');
    const alertMsgBox = document.querySelector('.alert-msg');

    function displayMessage() {
        let message = '';
        let isInfo = false;

        if (info) {
            isInfo = true;
            switch (info) {
                case 'register_complete':
                    message = 'Registration successful. You can now log in.';
                    break;
                default:
                    message = '';
            }
        } else if (error) {
            switch (error) {
                case 'user_exist':
                    message = 'Registration failed: Username already exists.';
                    break;
                case 'email_exist':
                    message = 'Registration failed: Email already exists.';
                    break;
                case 'registration_error':
                    message = 'Registration failed: Unable to register.';
                    break;
                case 'server_error':
                    message = 'Server error: Please try again later.';
                    break;
                case 'user_not_found':
                    message = 'Login failed: User not found.';
                    break;
                case 'incorrect_password':
                    message = 'Incorrect email/password combination.';
                    break;
                case 'login_error':
                    message = 'Login failed: Please try again.';
                    break;
                default:
                    message = 'An unknown error occurred.';
            }
        }

        if (message) {
            alertMsgBox.textContent = message;
            if (isInfo) {
                alertMsgBox.classList.add('info');
            } else {
                alertMsgBox.classList.remove('info');
            }
        }
    }

    displayMessage();
});

document.addEventListener('DOMContentLoaded', function ()   {
    const spotify = document.getElementById("spotify-container");

    if(spotify !== null){
        document.getElementById("login-container").style.display = "none";
        document.getElementById("register-container").style.display = "none";
        spotify.classList.add('active-form');
    }
});
