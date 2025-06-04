// הגדרות GitHub
const GITHUB_CONFIG = {
    owner: 'ronilemda', // שם המשתמש שלך
    repo: 'Asher_web', // שם הריפוזיטורי
    token: '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', // צריך להחליף בטוקן אמיתי
    dataFile: 'data.json' // שם קובץ הנתונים
};

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
                // אם הקובץ לא קיים, החזר אובייקט ריק
                return {};
            }

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const fileData = await response.json();
            const content = atob(fileData.content); // decode base64
            return JSON.parse(content);
        } catch (error) {
            console.error('שגיאה בטעינת נתונים:', error);
            // אם יש שגיאה, נסה לטעון מ-localStorage כגיבוי
            return this.loadFromLocalStorage();
        }
    }

    // שמירת נתונים ל-GitHub
    async saveData(data) {
        try {
            // קודם נקבל את ה-SHA הנוכחי של הקובץ (נדרש לעדכון)
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
                // אם הקובץ לא קיים, SHA יהיה null
            }

            // הכנת הנתונים לשמירה
            const content = btoa(JSON.stringify(data, null, 2)); // encode to base64
            
            const payload = {
                message: `עדכון נתונים - ${new Date().toLocaleString('he-IL')}`,
                content: content,
                ...(sha && { sha }) // הוסף SHA רק אם קיים
            };

            const response = await fetch(this.baseUrl, {
                method: 'PUT',
                headers: this.headers,
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            console.log('נתונים נשמרו בהצלחה ל-GitHub!');
            return true;
        } catch (error) {
            console.error('שגיאה בשמירת נתונים:', error);
            // גיבוי - שמור ב-localStorage
            this.saveToLocalStorage(data);
            return false;
        }
    }

    // גיבוי - טעינה מ-localStorage
    loadFromLocalStorage() {
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

    // גיבוי - שמירה ל-localStorage
    saveToLocalStorage(data) {
        for (let key in data) {
            localStorage.setItem(key, typeof data[key] === 'string' ? data[key] : JSON.stringify(data[key]));
        }
    }

    // סנכרון: טעינה מ-GitHub ועדכון localStorage
    async syncFromGitHub() {
        const data = await this.loadData();
        this.saveToLocalStorage(data);
        return data;
    }

    // סנכרון: שמירה ל-GitHub מ-localStorage
    async syncToGitHub() {
        const data = this.loadFromLocalStorage();
        return await this.saveData(data);
    }
}

// יצירת מנהל הנתונים
const dataManager = new GitHubDataManager(GITHUB_CONFIG);

// פונקציות עזר לשימוש באתר
window.GitHubSync = {
    // טעינת נתונים בתחילת האתר
    async init() {
        try {
            console.log('טוען נתונים מ-GitHub...');
            await dataManager.syncFromGitHub();
            console.log('נתונים נטענו בהצלחה!');
            
            // רענן את התצוגה אם יש פונקציה כזו
            if (typeof refreshDisplay === 'function') {
                refreshDisplay();
            }
        } catch (error) {
            console.error('שגיאה בטעינת נתונים:', error);
        }
    },

    // שמירה אוטומטית לאחר כל שינוי
    async autoSave() {
        try {
            console.log('שומר נתונים ל-GitHub...');
            const success = await dataManager.syncToGitHub();
            if (success) {
                console.log('נתונים נשמרו בהצלחה!');
                // הצג הודעה למשתמש
                this.showSaveMessage('✅ נתונים נשמרו בהצלחה!', 'success');
            } else {
                this.showSaveMessage('⚠️ שמירה ב-localStorage בלבד', 'warning');
            }
        } catch (error) {
            console.error('שגיאה בשמירה:', error);
            this.showSaveMessage('❌ שגיאה בשמירה', 'error');
        }
    },

    // הצגת הודעת סטטוס
    showSaveMessage(message, type) {
        // יצירת אלמנט הודעה
        const messageEl = document.createElement('div');
        messageEl.textContent = message;
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 20px;
            border-radius: 5px;
            color: white;
            font-weight: bold;
            z-index: 9999;
            ${type === 'success' ? 'background: #4CAF50;' : ''}
            ${type === 'warning' ? 'background: #FF9800;' : ''}
            ${type === 'error' ? 'background: #F44336;' : ''}
        `;
        
        document.body.appendChild(messageEl);
        
        // הסרת ההודעה אחרי 3 שניות
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.parentNode.removeChild(messageEl);
            }
        }, 3000);
    }
};

// דוגמה לשימוש - הוספת סרטון
async function addVideo(videoData) {
    // הוסף את הסרטון ל-localStorage (הקוד הקיים שלך)
    // ... הקוד הקיים ...
    
    // שמירה אוטומטית ל-GitHub
    await window.GitHubSync.autoSave();
}

// דוגמה לשימוש - מחיקת סרטון
async function deleteVideo(videoId) {
    // מחק את הסרטון מ-localStorage (הקוד הקיים שלך)
    // ... הקוד הקיים ...
    
    // שמירה אוטומטית ל-GitHub
    await window.GitHubSync.autoSave();
}

// הוספה לתחילת האתר
document.addEventListener('DOMContentLoaded', async () => {
    await window.GitHubSync.init();
});

// שמירה אוטומטית כל 5 דקות (אופציונלי)
setInterval(async () => {
    await window.GitHubSync.autoSave();
}, 5 * 60 * 1000); // 5 דקות
