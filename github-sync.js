// =============================================================================
// GitHub SYNC - הגדרות ראשוניות
// =============================================================================

// החלף את הפרטים האלה בשלך!
const GITHUB_CONFIG = {
    owner: 'ronilemda',                    // שם המשתמש שלך ב-GitHub
    repo: 'Asher_web',                     // שם הריפוזיטורי
   token: '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', // צריך להחליף בטוקן אמיתי
    dataFile: 'data.json'                  // שם קובץ הנתונים
};

// =============================================================================
// מנהל הסנכרון עם GitHub
// =============================================================================

class GitHubDataManager {
    constructor(config) {
        this.config = config;
        this.baseUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.dataFile}`;
        this.headers = {
            'Authorization': `token ${config.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };
    }

    // קריאת נתונים מ-GitHub
    async loadData() {
        try {
            const response = await fetch(this.baseUrl, {
                method: 'GET',
                headers: this.headers
            });

            if (response.status === 404) {
                return this.getCurrentLocalStorageData();
            }

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const fileData = await response.json();
            const content = atob(fileData.content);
            return JSON.parse(content);
        } catch (error) {
            console.error('שגיאה בטעינת נתונים מ-GitHub:', error);
            return this.getCurrentLocalStorageData();
        }
    }

    // קבלת כל הנתונים מ-localStorage
    getCurrentLocalStorageData() {
        const data = {};
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                try {
                    data[key] = JSON.parse(localStorage[key]);
                } catch (e) {
                    data[key] = localStorage[key];
                }
            }
        }
        return data;
    }

    // שמירת נתונים ל-GitHub
    async saveData(data) {
        try {
            let sha = null;
            try {
                const currentFile = await fetch(this.baseUrl, {
                    method: 'GET',
                    headers: this.headers
                });
                if (currentFile.ok) {
                    const fileData = await currentFile.json();
                    sha = fileData.sha;
                }
            } catch (e) {
                // הקובץ לא קיים
            }

            const content = btoa(JSON.stringify(data, null, 2));
            
            const payload = {
                message: `עדכון נתונים - ${new Date().toLocaleString('he-IL')}`,
                content: content,
                ...(sha && { sha })
            };

            const response = await fetch(this.baseUrl, {
                method: 'PUT',
                headers: this.headers,
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            console.log('✅ נתונים נשמרו בהצלחה ל-GitHub!');
            return true;
        } catch (error) {
            console.error('❌ שגיאה בשמירת נתונים ל-GitHub:', error);
            return false;
        }
    }

    // סנכרון מ-GitHub ל-localStorage
    async syncFromGitHub() {
        const data = await this.loadData();
        
        for (const [key, value] of Object.entries(data)) {
            if (value !== null) {
                localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
            }
        }
        
        return data;
    }

    // סנכרון מ-localStorage ל-GitHub
    async syncToGitHub() {
        const data = this.getCurrentLocalStorageData();
        return await this.saveData(data);
    }
}

// יצירת מנהל הנתונים
const dataManager = new GitHubDataManager(GITHUB_CONFIG);

// =============================================================================
// פונקציות עזר גלובליות
// =============================================================================

window.GitHubSync = {
    // טעינת נתונים בתחילה
    async init() {
        try {
            console.log('🔄 טוען נתונים מ-GitHub...');
            await dataManager.syncFromGitHub();
            console.log('✅ נתונים נטענו בהצלחה!');
            
            // 👇 הוסף כאן קריאה לפונקציה שלך שטוענת את הנתונים
            // if (typeof yourLoadFunction === 'function') {
            //     yourLoadFunction();
            // }
            
        } catch (error) {
            console.error('❌ שגיאה בטעינת נתונים:', error);
        }
    },

    // שמירה אוטומטית
    async autoSave() {
        try {
            console.log('💾 שומר נתונים ל-GitHub...');
            const success = await dataManager.syncToGitHub();
            
            if (success) {
                this.showMessage('✅ נתונים נשמרו בהצלחה!', 'success');
            } else {
                this.showMessage('⚠️ נשמר מקומית בלבד', 'warning');
            }
        } catch (error) {
            console.error('❌ שגיאה בשמירה:', error);
            this.showMessage('❌ שגיאה בשמירה', 'error');
        }
    },

    // הצגת הודעות
    showMessage(message, type) {
        const messageEl = document.createElement('div');
        messageEl.textContent = message;
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 20px;
            border-radius: 8px;
            color: white;
            font-weight: bold;
            z-index: 9999;
            font-family: Arial, sans-serif;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            ${type === 'success' ? 'background: #4CAF50;' : ''}
            ${type === 'warning' ? 'background: #FF9800;' : ''}
            ${type === 'error' ? 'background: #F44336;' : ''}
        `;
        
        document.body.appendChild(messageEl);
        
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.parentNode.removeChild(messageEl);
            }
        }, 3000);
    }
};

// =============================================================================
// 👇👇👇 הדבק את הקוד שלך כאן! 👇👇👇
// =============================================================================

const LOCAL_STORAGE_KEY = 'asherVideos';
const LOCAL_STORAGE_PROFILE_KEY = 'asherProfilePhoto';
const LOCAL_STORAGE_BACKGROUND_KEY = 'asherBackgroundSettings';
const LOCAL_STORAGE_CATEGORIES_KEY = 'asherCategoriesConfig';

/* 
📋 הדבק את הקוד הקיים שלך כאן!
כל הקוד שהיה לך לפני - משתנים, פונקציות, הכל.
*/


// =============================================================================
// 👆👆👆 סוף הקוד שלך 👆👆👆
// =============================================================================

// =============================================================================
// הוראות לעדכון הפונקציות הקיימות שלך
// =============================================================================

/*
🔧 איך לעדכן את הפונקציות שלך:

1. כל פונקציה שעושה localStorage.setItem - הוסף בסוף שלה:
   await window.GitHubSync.autoSave();

2. כל פונקציה שמשנה נתונים - הפוך אותה ל-async:
   function myFunction() → async function myFunction()

3. דוגמאות:

   לפני:
   function addVideo(data) {
       videos.push(data);
       localStorage.setItem('asherVideos', JSON.stringify(videos));
   }

   אחרי:
   async function addVideo(data) {
       videos.push(data);
       localStorage.setItem('asherVideos', JSON.stringify(videos));
       await window.GitHubSync.autoSave(); // 👈 הוסף את השורה הזו
   }

4. אם יש לך פונקציית טעינה (כמו loadVideos), הוסף קריאה אליה בפונקציה init למעלה
*/

// =============================================================================
// הפעלה אוטומטית
// =============================================================================

// טעינה אוטומטית בתחילת האתר
document.addEventListener('DOMContentLoaded', async () => {
    await window.GitHubSync.init();
});

// שמירה אוטומטית כל 5 דקות (אופציונלי)
setInterval(async () => {
    await window.GitHubSync.autoSave();
}, 5 * 60 * 1000);

// =============================================================================
// 🎯 סיכום מה שאתה צריך לעשות:
// =============================================================================

/*
✅ 1. החלף 'YOUR_GITHUB_TOKEN_HERE' בטוקן האמיתי שלך
✅ 2. הדבק את כל הקוד הקיים שלך באמצע
✅ 3. הוסף 'await window.GitHubSync.autoSave();' לכל פונקציה שמשנה נתונים
✅ 4. הפוך את הפונקציות האלה ל-async
✅ 5. שמור את הקובץ בשם github-sync.js
✅ 6. הוסף <script src="github-sync.js"></script> ל-HTML
*/
