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

document.addEventListener('DOMContentLoaded', function () {
    const fileInput = document.getElementById('profile-picture');
    const signUpForm = document.querySelector('#register-container form');
    const signUpAlertMsg = document.querySelector('.register-container .alert-msg');
    const preview = document.getElementById('avatar-preview');
    const previewImg = document.getElementById('avatar-preview-img');

    const cropModal = document.getElementById('crop-modal');
    const cropCanvas = document.getElementById('crop-canvas');
    const cropZoom = document.getElementById('crop-zoom');
    const cropApply = document.getElementById('crop-apply');
    const cropCancel = document.getElementById('crop-cancel');

    if (!fileInput || !signUpForm || !signUpAlertMsg || !preview || !previewImg || !cropModal || !cropCanvas || !cropZoom || !cropApply || !cropCancel) {
        return;
    }

    const ctx = cropCanvas.getContext('2d');
    const OUTPUT_SIZE = 512;
    let cropImage = null;
    let isCropped = false;
    let offsetX = 0;
    let offsetY = 0;
    let scale = 1;
    let minScale = 1;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let activeObjectUrl = null;
    let activePreviewUrl = null;

    function setPreview(url) {
        if (activePreviewUrl) {
            URL.revokeObjectURL(activePreviewUrl);
        }
        activePreviewUrl = url;
        previewImg.src = url;
        preview.classList.add('is-visible');
    }

    function clearPreview() {
        if (activePreviewUrl) {
            URL.revokeObjectURL(activePreviewUrl);
            activePreviewUrl = null;
        }
        previewImg.removeAttribute('src');
        preview.classList.remove('is-visible');
    }

    function showModal() {
        cropModal.classList.add('is-visible');
        document.body.classList.add('modal-open');
        cropModal.setAttribute('aria-hidden', 'false');
    }

    function hideModal() {
        cropModal.classList.remove('is-visible');
        document.body.classList.remove('modal-open');
        cropModal.setAttribute('aria-hidden', 'true');
    }

    function clampOffsets() {
        const canvasSize = cropCanvas.width;
        const imgWidth = cropImage.width * scale;
        const imgHeight = cropImage.height * scale;
        const minX = canvasSize - imgWidth;
        const minY = canvasSize - imgHeight;

        offsetX = Math.min(0, Math.max(minX, offsetX));
        offsetY = Math.min(0, Math.max(minY, offsetY));
    }

    function drawCrop() {
        if (!cropImage) {
            return;
        }
        const canvasSize = cropCanvas.width;
        ctx.clearRect(0, 0, canvasSize, canvasSize);
        ctx.drawImage(
            cropImage,
            offsetX,
            offsetY,
            cropImage.width * scale,
            cropImage.height * scale
        );
    }

    function resizeCropCanvas() {
        if (!cropImage) {
            return;
        }
        const maxSize = Math.min(window.innerWidth - 48, window.innerHeight - 280);
        const canvasSize = Math.max(220, Math.min(360, maxSize));
        cropCanvas.width = canvasSize;
        cropCanvas.height = canvasSize;

        minScale = Math.max(canvasSize / cropImage.width, canvasSize / cropImage.height);
        scale = minScale * Number(cropZoom.value || 1);

        offsetX = (canvasSize - cropImage.width * scale) / 2;
        offsetY = (canvasSize - cropImage.height * scale) / 2;
        clampOffsets();
        drawCrop();
    }

    function openCropper(file) {
        if (activeObjectUrl) {
            URL.revokeObjectURL(activeObjectUrl);
        }
        activeObjectUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = function () {
            cropImage = img;
            cropZoom.value = 1;
            resizeCropCanvas();
            showModal();
            if (activeObjectUrl) {
                URL.revokeObjectURL(activeObjectUrl);
                activeObjectUrl = null;
            }
        };
        img.src = activeObjectUrl;
    }

    fileInput.addEventListener('change', function () {
        const file = fileInput.files && fileInput.files[0];
        isCropped = false;
        if (!file) {
            clearPreview();
            return;
        }
        if (!file.type.startsWith('image/')) {
            signUpAlertMsg.textContent = 'Please select an image file.';
            fileInput.value = '';
            clearPreview();
            return;
        }
        openCropper(file);
    });

    cropZoom.addEventListener('input', function () {
        if (!cropImage) {
            return;
        }
        const canvasSize = cropCanvas.width;
        const prevScale = scale;
        const centerX = (canvasSize / 2 - offsetX) / prevScale;
        const centerY = (canvasSize / 2 - offsetY) / prevScale;

        scale = minScale * Number(cropZoom.value);
        offsetX = canvasSize / 2 - centerX * scale;
        offsetY = canvasSize / 2 - centerY * scale;
        clampOffsets();
        drawCrop();
    });

    cropCanvas.addEventListener('pointerdown', function (event) {
        if (!cropImage) {
            return;
        }
        dragging = true;
        lastX = event.clientX;
        lastY = event.clientY;
        cropCanvas.setPointerCapture(event.pointerId);
    });

    cropCanvas.addEventListener('pointermove', function (event) {
        if (!dragging || !cropImage) {
            return;
        }
        offsetX += event.clientX - lastX;
        offsetY += event.clientY - lastY;
        lastX = event.clientX;
        lastY = event.clientY;
        clampOffsets();
        drawCrop();
    });

    function stopDrag(event) {
        if (!dragging) {
            return;
        }
        dragging = false;
        if (event && event.pointerId !== undefined) {
            cropCanvas.releasePointerCapture(event.pointerId);
        }
    }

    cropCanvas.addEventListener('pointerup', stopDrag);
    cropCanvas.addEventListener('pointercancel', stopDrag);
    cropCanvas.addEventListener('pointerleave', stopDrag);

    cropCancel.addEventListener('click', function () {
        hideModal();
        fileInput.value = '';
        isCropped = false;
        cropImage = null;
        clearPreview();
    });

    cropApply.addEventListener('click', function () {
        if (!cropImage) {
            hideModal();
            return;
        }
        const canvasSize = cropCanvas.width;
        const outputCanvas = document.createElement('canvas');
        outputCanvas.width = OUTPUT_SIZE;
        outputCanvas.height = OUTPUT_SIZE;
        const outCtx = outputCanvas.getContext('2d');
        const scaleFactor = OUTPUT_SIZE / canvasSize;

        outCtx.drawImage(
            cropImage,
            offsetX * scaleFactor,
            offsetY * scaleFactor,
            cropImage.width * scale * scaleFactor,
            cropImage.height * scale * scaleFactor
        );

        outputCanvas.toBlob((blob) => {
            if (!blob) {
                return;
            }
            const croppedFile = new File([blob], `profile_${Date.now()}.jpg`, { type: 'image/jpeg' });
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(croppedFile);
            fileInput.files = dataTransfer.files;
            isCropped = true;
            setPreview(URL.createObjectURL(blob));
            hideModal();
        }, 'image/jpeg', 0.92);
    });

    signUpForm.addEventListener('submit', function (event) {
        if (event.defaultPrevented) {
            return;
        }
        if (fileInput.files.length > 0 && !isCropped) {
            event.preventDefault();
            signUpAlertMsg.textContent = 'Please crop your profile photo.';
            openCropper(fileInput.files[0]);
        }
    });

    window.addEventListener('resize', function () {
        if (cropModal.classList.contains('is-visible')) {
            resizeCropCanvas();
        }
    });
});
