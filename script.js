**בבקשה, צור קובץ חדש בשם `script.js` באותה תיקייה כמו קובץ ה-`index.html` שלך, והדבק בו את כל הקוד הבא.**

זהו קובץ ה-JavaScript הראשי של האתר שלך. הוא מכיל את כל הלוגיקה שדיברנו עליה, כולל:
* ייבוא של `db` ו-`storage` מתוך קוד האתחול של Firebase ב-HTML.
* פונקציות בסיסיות לניהול מצב מנהל (כולל סיסמה קבועה כרגע - **זכור שזה לא מאובטח לאתר חי!**).
* הטמעת פונקציות לשמירה וטעינה של **סרטונים** מ-Firestore.
* הטמעת פונקציה להעלאת תמונות ל-Firebase Storage.
* הגדרת מאזיני אירועים לכפתורים ולטפסים.

**לאחר שתיצור את הקובץ ותדביק את הקוד, וודא שוב ששני הקבצים (`index.html` ו-`script.js`) נמצאים באותה תיקייה, ואז העלה אותם שוב ל-Netlify.**

```javascript
// ייבוא מופעי Firebase מתוך קובץ ה-HTML
// חשוב: נתיב זה עובד ב-type="module" כאשר script.js ו-index.html נמצאים באותה תיקייה
import { db, storage } from './index.html'; 

// ייבוא פונקציות ספציפיות מ-Firebase SDK
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-storage.js";

// === משתנים גלובליים ===
let isAdminMode = false;
const ADMIN_PASSWORD = "12345"; // !!! חשוב: לא מאובטח לאתר חי. יש להשתמש ב-Firebase Authentication !!!

let cropper; // משתנה גלובלי עבור Cropper.js
let currentImageUploadType; // 'profile', 'backgroundLeft', 'backgroundRight'
let currentImageUploadElement; // האלמנט שממנו הועלתה התמונה (input type="file")
let currentInputUrlElement; // האלמנט שבו נציג את ה-URL של התמונה לאחר העלאה

// === אלמנטים מה-DOM ===
const adminLoginBtn = document.getElementById('adminLoginBtn');
const adminLoginModal = document.getElementById('adminLoginModal');
const closeAdminLoginModalBtn = document.getElementById('closeAdminLoginModalBtn');
const adminLoginForm = document.getElementById('adminLoginForm');
const adminPasswordInput = document.getElementById('adminPassword');
const adminPanel = document.getElementById('adminPanel');

const toggleAddVideoFormBtn = document.getElementById('toggleAddVideoFormBtn');
const addVideoForm = document.getElementById('addVideoForm');
const addVideoFormElement = document.getElementById('addVideoFormElement');

const toggleDeleteModeBtn = document.getElementById('toggleDeleteModeBtn');
const exitAdminBtn = document.getElementById('exitAdminBtn');

const grandpaPhoto = document.getElementById('grandpaPhoto');
const profileImageUpload = document.getElementById('profileImageUpload');
const changeProfileImageBtn = document.getElementById('changeProfileImageBtn');

const toggleBackgroundSettingsFormBtn = document.getElementById('toggleBackgroundSettingsFormBtn');
const backgroundSettingsForm = document.getElementById('backgroundSettingsForm');
const backgroundSettingsFormElement = document.getElementById('backgroundSettingsFormElement');

const bgImageUrlUploadLeft = document.getElementById('bgImageUrlUploadLeft');
const bgImageUrlUploadRight = document.getElementById('bgImageUrlUploadRight');
const bgImageUrlLeftInput = document.getElementById('bgImageUrlLeft');
const bgImageUrlRightInput = document.getElementById('bgImageUrlRight');

const openManageCategoriesModalBtn = document.getElementById('openManageCategoriesModalBtn');

const openEmailModalBtn = document.getElementById('openEmailModalBtn');
const emailModal = document.getElementById('emailModal');
const closeEmailModalBtn = document.getElementById('closeEmailModalBtn');

const youtubeChannelLink = document.getElementById('youtubeChannelLink');

const categoryFiltersContainer = document.getElementById('categoryFiltersContainer');
const videoCategoriesContainer = document.getElementById('videoCategoriesContainer');

// אלמנטים של מודאל החיתוך
const cropModal = document.getElementById('cropModal');
const closeCropModalBtn = document.getElementById('closeCropModalBtn');
const imageToCrop = document.getElementById('imageToCrop');
const cropImageBtn = document.getElementById('cropImageBtn');
const cancelCropBtn = document.getElementById('cancelCropBtn');

// === פונקציות עזר ===

// פונקציה להצגת הודעה למשתמש (במקום alert)
function showMessage(message, type = 'info') {
    // ניתן להטמיע כאן מודאל הודעות יפה יותר במקום alert
    // לדוגמה: יצירת אלמנט div והצגתו למספר שניות
    alert(message);
}

// === ניהול מצב מנהל ===
function showAdminLogin() {
    adminLoginModal.style.display = 'block';
}

function closeAdminLoginModal() {
    adminLoginModal.style.display = 'none';
    adminPasswordInput.value = ''; // נקה סיסמה
}

function checkAdminPassword(event) {
    event.preventDefault();
    const password = adminPasswordInput.value;
    if (password === ADMIN_PASSWORD) {
        isAdminMode = true;
        document.body.classList.add('admin-mode');
        adminPanel.classList.add('active');
        closeAdminLoginModal();
        showMessage('מצב מנהל הופעל בהצלחה!', 'success');
        // טען את הגדרות הרקע והקטגוריות לאחר הפעלת מצב מנהל
        loadBackgroundSettings();
        loadCategories();
    } else {
        showMessage('סיסמה שגויה. נסה שוב.', 'error');
    }
}

function exitAdmin() {
    isAdminMode = false;
    document.body.classList.remove('admin-mode');
    adminPanel.classList.remove('active');
    addVideoForm.classList.remove('active'); // סגור טופס הוספת סרטון
    backgroundSettingsForm.classList.remove('active'); // סגור טופס רקע
    showMessage('מצב מנהל כובה.', 'info');
    // רענן את התצוגה כדי להסתיר כפתורי מחיקה/עריכה
    loadVideos();
    loadCategories();
}

function toggleAddVideoForm() {
    addVideoForm.classList.toggle('active');
    backgroundSettingsForm.classList.remove('active'); // וודא שטופס רקע סגור
}

function toggleDeleteMode() {
    if (isAdminMode) {
        // מצב מחיקה פשוט מופעל/מוסר ע"י CSS
        // ה-CSS כבר מטפל בהצגת כפתורי המחיקה/עריכה במצב admin-mode
        showMessage('כפתורי מחיקה ועריכה גלויים כעת.', 'info');
    }
}

function toggleBackgroundSettingsForm() {
    backgroundSettingsForm.classList.toggle('active');
    addVideoForm.classList.remove('active'); // וודא שטופס הוספת סרטון סגור
    if (backgroundSettingsForm.classList.contains('active')) {
        loadBackgroundSettings(); // טען הגדרות קיימות כשפותחים את הטופס
    }
}

// === ניהול מודאל אימייל ===
function openEmailModal() {
    emailModal.style.display = 'block';
}

function closeEmailModal() {
    emailModal.style.display = 'none';
}

// === ניהול מודאל חיתוך תמונה ===
function openCropModal(imageUrl, uploadType, inputElement, inputUrlElement) {
    cropModal.style.display = 'block';
    imageToCrop.src = imageUrl;
    currentImageUploadType = uploadType;
    currentImageUploadElement = inputElement;
    currentInputUrlElement = inputUrlElement;

    // אתחל את Cropper.js
    if (cropper) {
        cropper.destroy();
    }
    cropper = new Cropper(imageToCrop, {
        aspectRatio: (uploadType === 'profile') ? 1 / 1 : NaN, // 1:1 ליחס תמונה לפרופיל, חופשי לאחרים
        viewMode: 1, // מונע מחוץ לקנבס
        autoCropArea: 0.8, // אזור חיתוך אוטומטי
    });
}

function closeCropModal() {
    cropModal.style.display = 'none';
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
    // נקה את קובץ הקלט כדי לאפשר העלאה חוזרת של אותה תמונה
    if (currentImageUploadElement) {
        currentImageUploadElement.value = '';
    }
}

// === העלאת תמונות ל-Firebase Storage ===
async function uploadImageToFirebaseStorage(file, path) {
    try {
        const storageRef = ref(storage, path + '/' + file.name);
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        return downloadURL;
    } catch (error) {
        console.error("שגיאה בהעלאת תמונה ל-Storage:", error);
        showMessage("שגיאה בהעלאת תמונה: " + error.message, 'error');
        return null;
    }
}

async function handleImageUpload(event, type) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        openCropModal(e.target.result, type, event.target,
            (type === 'profile') ? grandpaPhoto :
            (type === 'backgroundLeft') ? bgImageUrlLeftInput :
            (type === 'backgroundRight') ? bgImageUrlRightInput : null
        );
    };
    reader.readAsDataURL(file);
}

cropImageBtn.addEventListener('click', async () => {
    if (cropper) {
        try {
            const canvas = cropper.getCroppedCanvas();
            canvas.toBlob(async (blob) => {
                if (blob) {
                    const file = new File([blob], "cropped_image.png", { type: "image/png" });
                    let imageUrl = null;
                    let storagePath = '';

                    if (currentImageUploadType === 'profile') {
                        storagePath = 'profile_photos';
                    } else if (currentImageUploadType === 'backgroundLeft') {
                        storagePath = 'background_images/left';
                    } else if (currentImageUploadType === 'backgroundRight') {
                        storagePath = 'background_images/right';
                    }

                    if (storagePath) {
                        imageUrl = await uploadImageToFirebaseStorage(file, storagePath);
                    }

                    if (imageUrl) {
                        if (currentImageUploadType === 'profile') {
                            // שמור את ה-URL של תמונת הפרופיל ב-Firestore
                            await updateProfilePhoto(imageUrl);
                        } else if (currentImageUploadType === 'backgroundLeft' || currentImageUploadType === 'backgroundRight') {
                            // עדכן את שדה ה-URL בטופס
                            if (currentInputUrlElement) {
                                currentInputUrlElement.value = imageUrl;
                            }
                        }
                        showMessage('התמונה נשמרה בהצלחה!', 'success');
                    } else {
                        showMessage('שגיאה בשמירת התמונה לאחר החיתוך.', 'error');
                    }
                    closeCropModal();
                }
            }, 'image/png');
        } catch (error) {
            console.error("שגיאה בחיתוך או העלאת תמונה:", error);
            showMessage("שגיאה בחיתוך או העלאת תמונה: " + error.message, 'error');
        }
    }
});

cancelCropBtn.addEventListener('click', () => {
    closeCropModal();
});

// === לוגיקה של סרטונים (Firestore) ===

// פונקציה להוספת סרטון חדש ל-Firestore
async function addNewVideo(event) {
    event.preventDefault(); // מונע ריענון דף
    if (!isAdminMode) {
        showMessage('אין לך הרשאה להוסיף סרטונים.', 'error');
        return;
    }

    const videoData = {
        title: document.getElementById('videoTitle').value,
        description: document.getElementById('videoDescription').value,
        thumbnailUrl: document.getElementById('videoThumbnailUrl').value,
        category: document.getElementById('videoCategory').value,
        subCategory: document.getElementById('videoSubCategory').value,
        subSubCategory: document.getElementById('videoSubSubCategory').value,
        youtubeLink: document.getElementById('youtubeLink').value,
        tiktokLink: document.getElementById('tiktokLink').value,
        createdAt: new Date() // חותמת זמן ליצירה
    };

    try {
        await addDoc(collection(db, "videos"), videoData);
        showMessage('הסרטון נוסף בהצלחה!', 'success');
        addVideoFormElement.reset(); // נקה את הטופס
        loadVideos(); // רענן את רשימת הסרטונים
    } catch (e) {
        console.error("שגיאה בהוספת סרטון: ", e);
        showMessage('שגיאה בהוספת סרטון: ' + e.message, 'error');
    }
}

// פונקציה לטעינת סרטונים מ-Firestore והצגתם
async function loadVideos() {
    videoCategoriesContainer.innerHTML = ''; // נקה את התוכן הקיים

    try {
        // קבל את כל הקטגוריות הפעילות
        const categoriesSnapshot = await getDocs(query(collection(db, "categories"), orderBy("order", "asc")));
        const categories = categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // קבל את כל הסרטונים
        const videosSnapshot = await getDocs(query(collection(db, "videos"), orderBy("createdAt", "desc")));
        const videos = videosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // קבץ סרטונים לפי קטגוריה
        const videosByCategory = {};
        categories.forEach(cat => {
            videosByCategory[cat.name] = [];
            if (cat.subCategories) {
                cat.subCategories.forEach(subCat => {
                    videosByCategory[subCat.name] = [];
                    if (subCat.subSubCategories) {
                        subCat.subSubCategories.forEach(subSubCat => {
                            videosByCategory[subSubCat.name] = [];
                        });
                    }
                });
            }
        });

        videos.forEach(video => {
            if (video.subSubCategory && videosByCategory[video.subSubCategory]) {
                videosByCategory[video.subSubCategory].push(video);
            } else if (video.subCategory && videosByCategory[video.subCategory]) {
                videosByCategory[video.subCategory].push(video);
            } else if (video.category && videosByCategory[video.category]) {
                videosByCategory[video.category].push(video);
            } else {
                // סרטונים ללא קטגוריה או קטגוריה לא קיימת
                if (!videosByCategory['ללא קטגוריה']) {
                    videosByCategory['ללא קטגוריה'] = [];
                }
                videosByCategory['ללא קטגוריה'].push(video);
            }
        });

        // הצג סרטונים לפי קטגוריות
        categories.forEach(cat => {
            renderCategorySection(cat.name, videosByCategory[cat.name] || [], cat.icon);
            if (cat.subCategories) {
                cat.subCategories.forEach(subCat => {
                    renderCategorySection(subCat.name, videosByCategory[subCat.name] || [], subCat.icon, cat.name);
                    if (subCat.subSubCategories) {
                        subCat.subSubCategories.forEach(subSubCat => {
                            renderCategorySection(subSubCat.name, videosByCategory[subSubCat.name] || [], subSubCat.icon, subCat.name);
                        });
                    }
                });
            }
        });

        // אם יש סרטונים ללא קטגוריה, הצג אותם
        if (videosByCategory['ללא קטגוריה'] && videosByCategory['ללא קטגוריה'].length > 0) {
            renderCategorySection('ללא קטגוריה', videosByCategory['ללא קטגוריה'], '❓');
        }

    } catch (e) {
        console.error("שגיאה בטעינת סרטונים או קטגוריות: ", e);
        showMessage('שגיאה בטעינת סרטונים: ' + e.message, 'error');
    }
}

// פונקציה לעיבוד והצגת סרטונים בקטגוריה מסוימת
function renderCategorySection(categoryName, videos, icon = '', parentCategory = '') {
    if (videos.length === 0) return; // אל תציג קטגוריות ריקות

    const sectionId = `category-${categoryName.replace(/\s+/g, '-')}`; // יצירת ID ייחודי
    let section = document.getElementById(sectionId);

    if (!section) {
        section = document.createElement('div');
        section.className = 'category-section';
        section.id = sectionId;
        videoCategoriesContainer.appendChild(section);
    }

    section.innerHTML = `
        <h2 class="category-title">${icon} ${categoryName}</h2>
        <div class="video-gallery">
            ${videos.map(video => `
                <div class="video-card ${isAdminMode ? 'admin-mode-card' : ''}" data-id="${video.id}" data-category="${video.category}" data-sub-category="${video.subCategory || ''}" data-sub-sub-category="${video.subSubCategory || ''}">
                    <button class="delete-btn" data-id="${video.id}"><i class="fas fa-trash"></i></button>
                    <button class="edit-btn" data-id="${video.id}"><i class="fas fa-edit"></i></button>
                    <img src="${video.thumbnailUrl || 'https://placehold.co/300x180/cccccc/333333?text=No+Thumbnail'}" alt="${video.title}" class="video-thumbnail">
                    <h3 class="video-title">${video.title}</h3>
                    <p class="video-description">${video.description}</p>
                    <div class="video-actions">
                        ${video.youtubeLink ? `<a href="${video.youtubeLink}" target="_blank" class="btn btn-youtube"><i class="fab fa-youtube"></i> צפה ביוטיוב</a>` : ''}
                        ${video.tiktokLink ? `<a href="${video.tiktokLink}" target="_blank" class="btn btn-tiktok"><i class="fab fa-tiktok"></i> צפה בטיקטוק</a>` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    // הוסף מאזיני אירועים לכפתורי מחיקה ועריכה
    section.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', (e) => deleteVideo(e.currentTarget.dataset.id));
    });
    section.querySelectorAll('.edit-btn').forEach(button => {
        button.addEventListener('click', (e) => editVideo(e.currentTarget.dataset.id));
    });

    // וודא שכפתורי מחיקה/עריכה מוצגים/מוסתרים נכון במצב מנהל
    if (isAdminMode) {
        section.querySelectorAll('.video-card').forEach(card => card.classList.add('admin-mode-card'));
    } else {
        section.querySelectorAll('.video-card').forEach(card => card.classList.remove('admin-mode-card'));
    }
}

// פונקציה למחיקת סרטון מ-Firestore
async function deleteVideo(videoId) {
    if (!isAdminMode) {
        showMessage('אין לך הרשאה למחוק סרטונים.', 'error');
        return;
    }
    // במקום confirm(), נשתמש במודאל הודעה מותאם אישית אם תרצה
    if (!confirm('האם אתה בטוח שברצונך למחוק סרטון זה?')) {
        return;
    }

    try {
        await deleteDoc(doc(db, "videos", videoId));
        showMessage('הסרטון נמחק בהצלחה!', 'success');
        loadVideos(); // רענן את רשימת הסרטונים
    } catch (e) {
        console.error("שגיאה במחיקת סרטון: ", e);
        showMessage('שגיאה במחיקת סרטון: ' + e.message, 'error');
    }
}

// פונקציה לעריכת סרטון (תצטרך להטמיע מודאל עריכה)
async function editVideo(videoId) {
    if (!isAdminMode) {
        showMessage('אין לך הרשאה לערוך סרטונים.', 'error');
        return;
    }
    // כאן תצטרך לטעון את נתוני הסרטון למודאל עריכה
    try {
        const videoDoc = await getDoc(doc(db, "videos", videoId));
        if (videoDoc.exists()) {
            const videoData = videoDoc.data();
            // פתח מודאל עריכה ומלא את השדות עם videoData
            // לדוגמה:
            // document.getElementById('editVideoTitle').value = videoData.title;
            // ...
            // לאחר שהמשתמש יסיים לערוך וישלח את הטופס, תצטרך לקרוא לפונקציה updateDoc
            showMessage('פונקציית עריכה תטען נתונים למודאל בקרוב... (עדיין לא ממומש במלואו)', 'info');
        } else {
            showMessage('הסרטון לא נמצא.', 'error');
        }
    } catch (e) {
        console.error("שגיאה בטעינת סרטון לעריכה: ", e);
        showMessage('שגיאה בטעינת סרטון לעריכה: ' + e.message, 'error');
    }
}

// === לוגיקה של קטגוריות (Firestore) ===

// פונקציה לטעינת קטגוריות מ-Firestore
async function loadCategories() {
    const categorySelect = document.getElementById('videoCategory');
    categorySelect.innerHTML = '<option value="">בחר קטגוריה</option>'; // נקה ובחר ברירת מחדל
    categoryFiltersContainer.innerHTML = ''; // נקה את כפתורי הסינון

    try {
        const categoriesSnapshot = await getDocs(query(collection(db, "categories"), orderBy("order", "asc")));
        const categories = categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // הוסף כפתור "הכל" ראשון
        const allBtn = document.createElement('button');
        allBtn.className = 'category-btn active'; // פעיל כברירת מחדל
        allBtn.textContent = 'הכל';
        allBtn.dataset.category = 'all';
        categoryFiltersContainer.appendChild(allBtn); 

        categories.forEach(cat => {
            // הוסף לאפשרויות הטופס
            const option = document.createElement('option');
            option.value = cat.name;
            option.textContent = cat.name;
            categorySelect.appendChild(option);

            // הוסף כפתור סינון
            const btnWrapper = document.createElement('div');
            btnWrapper.className = 'category-btn-wrapper';
            btnWrapper.innerHTML = `
                <button class="category-btn" data-category="${cat.name}">${cat.icon || ''} ${cat.name}</button>
                ${isAdminMode ? `<button class="category-delete-btn" data-id="${cat.id}"><i class="fas fa-times"></i></button>` : ''}
            `;
            categoryFiltersContainer.appendChild(btnWrapper);
        });

        // הוסף מאזיני אירועים לכפתורי הסינון
        categoryFiltersContainer.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', (e) => filterVideosByCategory(e.currentTarget.dataset.category));
        });

        // הוסף מאזיני אירועים לכפתורי מחיקת קטגוריה
        categoryFiltersContainer.querySelectorAll('.category-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => deleteCategory(e.currentTarget.dataset.id));
        });

        // טען תת-קטגוריות כשמשתנה הקטגוריה הראשית
        categorySelect.addEventListener('change', (e) => handleCategoryChange(e.target.value, categories));

    } catch (e) {
        console.error("שגיאה בטעינת קטגוריות: ", e);
        showMessage('שגיאה בטעינת קטגוריות: ' + e.message, 'error');
    }
}

// פונקציה לסינון סרטונים לפי קטגוריה
function filterVideosByCategory(selectedCategory) {
    const videoCards = document.querySelectorAll('.video-card');
    videoCards.forEach(card => {
        const category = card.dataset.category;
        const subCategory = card.dataset.subCategory;
        const subSubCategory = card.dataset.subSubCategory;

        if (selectedCategory === 'all' ||
            category === selectedCategory ||
            subCategory === selectedCategory ||
            subSubCategory === selectedCategory) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });

    // עדכן את כפתורי הסינון הפעילים
    categoryFiltersContainer.querySelectorAll('.category-btn').forEach(btn => {
        if (btn.dataset.category === selectedCategory) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// פונקציה לטיפול בשינוי קטגוריה בטופס הוספת סרטון
function handleCategoryChange(selectedCategoryName, categories) {
    const subCategoryGroup = document.getElementById('subCategoryGroup');
    const subCategorySelect = document.getElementById('videoSubCategory');
    const subSubCategoryGroup = document.getElementById('subSubCategoryGroup');
    const subSubCategorySelect = document.getElementById('videoSubSubCategory');

    subCategorySelect.innerHTML = '<option value="">בחר תת-קטגוריה</option>';
    subSubCategorySelect.innerHTML = '<option value="">בחר תת-תת-קטגוריה</option>';
    subCategoryGroup.style.display = 'none';
    subSubCategoryGroup.style.display = 'none';

    const selectedCat = categories.find(cat => cat.name === selectedCategoryName);

    if (selectedCat && selectedCat.subCategories && selectedCat.subCategories.length > 0) {
        subCategoryGroup.style.display = 'block';
        selectedCat.subCategories.forEach(subCat => {
            const option = document.createElement('option');
            option.value = subCat.name;
            option.textContent = subCat.name;
            subCategorySelect.appendChild(option);
        });

        // הוסף מאזין אירועים לתת-קטגוריה כדי לטעון תת-תת-קטגוריות
        subCategorySelect.onchange = (e) => { // השתמש ב-onchange ישירות כדי למנוע כפילויות
            const selectedSubCatName = e.target.value;
            const selectedSubCat = selectedCat.subCategories.find(subCat => subCat.name === selectedSubCatName);
            subSubCategorySelect.innerHTML = '<option value="">בחר תת-תת-קטגוריה</option>';
            subSubCategoryGroup.style.display = 'none';

            if (selectedSubCat && selectedSubCat.subSubCategories && selectedSubCat.subSubCategories.length > 0) {
                subSubCategoryGroup.style.display = 'block';
                selectedSubCat.subSubCategories.forEach(subSubCat => {
                    const option = document.createElement('option');
                    option.value = subSubCat.name;
                    option.textContent = subSubCat.name;
                    subSubCategorySelect.appendChild(option);
                });
            }
        };
    }
}

// פונקציה למחיקת קטגוריה (כולל תת-קטגוריות)
async function deleteCategory(categoryId) {
    if (!isAdminMode) {
        showMessage('אין לך הרשאה למחוק קטגוריות.', 'error');
        return;
    }
    // במקום confirm(), נשתמש במודאל הודעה מותאם אישית אם תרצה
    if (!confirm('האם אתה בטוח שברצונך למחוק קטגוריה זו? פעולה זו בלתי הפיכה!')) {
        return;
    }

    try {
        await deleteDoc(doc(db, "categories", categoryId));
        showMessage('הקטגוריה נמחקה בהצלחה!', 'success');
        loadCategories(); // רענן את רשימת הקטגוריות
        loadVideos(); // רענן את הסרטונים (כי קטגוריה אולי נעלמה)
    } catch (e) {
        console.error("שגיאה במחיקת קטגוריה: ", e);
        showMessage('שגיאה במחיקת קטגוריה: ' + e.message, 'error');
    }
}

// פונקציה לפתיחת מודאל ניהול קטגוריות (תצטרך להטמיע את המודאל עצמו)
function openManageCategoriesModal() {
    if (!isAdminMode) {
        showMessage('אין לך הרשאה לנהל קטגוריות.', 'error');
        return;
    }
    showMessage('מודאל ניהול קטגוריות יפתח בקרוב... (עדיין לא ממומש במלואו)', 'info');
    // כאן תצטרך להטמיע מודאל חדש לניהול קטגוריות, הוספה, עריכה ומחיקה
    // המודאל יצטרך לטעון את הקטגוריות הקיימות מ-Firestore
}


// === לוגיקה של הגדרות רקע (Firestore ו-Storage) ===

// פונקציה לשמירת הגדרות רקע
async function saveBackgroundSettings(event) {
    event.preventDefault();
    if (!isAdminMode) {
        showMessage('אין לך הרשאה לשמור הגדרות רקע.', 'error');
        return;
    }

    const bgSettings = {
        imageUrlLeft: bgImageUrlLeftInput.value,
        imageUrlRight: bgImageUrlRightInput.value,
        imageSize: document.getElementById('bgImageSize').value,
        position: document.querySelector('input[name="bgPosition"]:checked').value
    };

    try {
        // נשמור את ההגדרות במסמך יחיד בקולקציה 'settings'
        // ה-ID של המסמך יהיה קבוע, לדוגמה 'background'
        await setDoc(doc(db, "settings", "background"), bgSettings);
        showMessage('הגדרות הרקע נשמרו בהצלחה!', 'success');
        applyBackgroundSettings(bgSettings); // החל את ההגדרות מיד
    } catch (e) {
        console.error("שגיאה בשמירת הגדרות רקע: ", e);
        showMessage('שגיאה בשמירת הגדרות רקע: ' + e.message, 'error');
    }
}

// פונקציה לטעינת הגדרות רקע מ-Firestore
async function loadBackgroundSettings() {
    try {
        const settingsDoc = await getDoc(doc(db, "settings", "background"));
        if (settingsDoc.exists()) {
            const settings = settingsDoc.data();
            bgImageUrlLeftInput.value = settings.imageUrlLeft || '';
            bgImageUrlRightInput.value = settings.imageUrlRight || '';
            document.getElementById('bgImageSize').value = settings.imageSize || 40;
            const positionRadio = document.querySelector(`input[name="bgPosition"][value="${settings.position || 'none'}"]`);
            if (positionRadio) {
                positionRadio.checked = true;
            }
            applyBackgroundSettings(settings); // החל את ההגדרות
        }
    } catch (e) {
        console.error("שגיאה בטעינת הגדרות רקע: ", e);
        showMessage('שגיאה בטעינת הגדרות רקע: ' + e.message, 'error');
    }
}

// פונקציה להחלת הגדרות הרקע על ה-body
function applyBackgroundSettings(settings) {
    const body = document.body;
    let backgroundStyle = '';

    const size = settings.imageSize ? `${settings.imageSize}%` : '40%';

    if (settings.position === 'left' && settings.imageUrlLeft) {
        backgroundStyle = `url('${settings.imageUrlLeft}') no-repeat left bottom / ${size}`;
    } else if (settings.position === 'right' && settings.imageUrlRight) {
        backgroundStyle = `url('${settings.imageUrlRight}') no-repeat right bottom / ${size}`;
    } else if (settings.position === 'both' && settings.imageUrlLeft && settings.imageUrlRight) {
        backgroundStyle = `url('${settings.imageUrlLeft}') no-repeat left bottom / ${size}, url('${settings.imageUrlRight}') no-repeat right bottom / ${size}`;
    } else if (settings.position === 'none') {
        backgroundStyle = 'none'; // הסר תמונות רקע
    }

    // שמור את ה-gradient הקיים
    const currentGradient = body.style.background.match(/linear-gradient\([^)]+\)/);
    if (currentGradient) {
        if (backgroundStyle === 'none') {
            body.style.background = currentGradient[0]; // רק הגרדיאנט
        } else {
            body.style.background = `${backgroundStyle}, ${currentGradient[0]}`;
        }
    } else {
        body.style.background = backgroundStyle;
    }

    body.style.backgroundAttachment = 'fixed'; // וודא שזה נשאר קבוע
}

// פונקציה לעדכון תמונת הפרופיל (של הסבא)
async function updateProfilePhoto(imageUrl) {
    try {
        // נשמור את תמונת הפרופיל במסמך יחיד בקולקציה 'settings'
        await setDoc(doc(db, "settings", "profilePhoto"), { url: imageUrl });
        grandpaPhoto.src = imageUrl; // עדכן את התמונה מיד
        showMessage('תמונת הפרופיל עודכנה בהצלחה!', 'success');
    } catch (e) {
        console.error("שגיאה בעדכון תמונת פרופיל: ", e);
        showMessage('שגיאה בעדכון תמונת פרופיל: ' + e.message, 'error');
    }
}

// פונקציה לטעינת תמונת הפרופיל
async function loadProfilePhoto() {
    try {
        const profileDoc = await getDoc(doc(db, "settings", "profilePhoto"));
        if (profileDoc.exists()) {
            const data = profileDoc.data();
            if (data.url) {
                grandpaPhoto.src = data.url;
            }
        }
    } catch (e) {
        console.error("שגיאה בטעינת תמונת פרופיל: ", e);
    }
}

// === מאזיני אירועים ===
document.addEventListener('DOMContentLoaded', () => {
    // טען סרטונים וקטגוריות בפעם הראשונה
    loadVideos();
    loadCategories();
    loadBackgroundSettings();
    loadProfilePhoto();

    // מאזיני אירועים לפתיחת/סגירת מודאלים
    adminLoginBtn.addEventListener('click', showAdminLogin);
    closeAdminLoginModalBtn.addEventListener('click', closeAdminLoginModal);
    adminLoginForm.addEventListener('submit', checkAdminPassword);

    openEmailModalBtn.addEventListener('click', openEmailModal);
    closeEmailModalBtn.addEventListener('click', closeEmailModal);

    closeCropModalBtn.addEventListener('click', closeCropModal);

    // מאזיני אירועים לפאנל מנהל
    toggleAddVideoFormBtn.addEventListener('click', toggleAddVideoForm);
    toggleDeleteModeBtn.addEventListener('click', toggleDeleteMode);
    exitAdminBtn.addEventListener('click', exitAdmin);
    changeProfileImageBtn.addEventListener('click', () => profileImageUpload.click());
    profileImageUpload.addEventListener('change', (event) => handleImageUpload(event, 'profile'));
    toggleBackgroundSettingsFormBtn.addEventListener('click', toggleBackgroundSettingsForm);
    openManageCategoriesModalBtn.addEventListener('click', openManageCategoriesModal);

    // מאזיני אירועים לטפסים
    addVideoFormElement.addEventListener('submit', addNewVideo);
    backgroundSettingsFormElement.addEventListener('submit', saveBackgroundSettings);

    // מאזיני אירועים להעלאת תמונות רקע
    bgImageUrlUploadLeft.addEventListener('change', (event) => handleImageUpload(event, 'backgroundLeft'));
    bgImageUrlUploadRight.addEventListener('change', (event) => handleImageUpload(event, 'backgroundRight'));

    // טיפול בשינוי קטגוריה בטופס הוספת סרטון (נטען ב-loadCategories)
    // document.getElementById('videoCategory').addEventListener('change', (e) => handleCategoryChange(e.target.value));

    // סגירת מודאל בלחיצה מחוץ למודאל
    window.addEventListener('click', (event) => {
        if (event.target === adminLoginModal) {
            closeAdminLoginModal();
        }
        if (event.target === emailModal) {
            closeEmailModal();
        }
        if (event.target === cropModal) {
            closeCropModal();
        }
    });
});
```
