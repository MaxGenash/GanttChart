(function() {
    let helpers = {
        rndColor() {
            return "#" + Math.floor( Math.random() * 0xFFFFFF ).toString(16);
        }
    };

    let app = {
        initialize() {
            this.GCBlock = document.getElementById("GC-block");
            this.settingsBlock = document.getElementById("settings");
            this.zoomSelectEl = document.getElementById("zoom__select");
            this.errorBlock = document.getElementById("error-block");

            //можливі масштаби
            this.scalesDictionary = [
                {
                    title: "100px : 1 день",    //текст що буде в елементі select
                    timeLength: 1000*60*60*24,  //коефіцієнт що відповідає часу
                    width: 100,                 //ширина комірки в px
                    disabled: false              //чи доступний масштаб(якщо він занадто великий, то буде недоступним)
                },
                {title: "50px : 1 день", timeLength: 1000*60*60*24, width: 50, disabled: false},
                {title: "30px : 1 день", timeLength: 1000*60*60*24, width: 30, disabled: false},
                {title: "20px : 1 день", timeLength: 1000*60*60*24, width: 20, disabled: false},
                {title: "200px : 1 місяць", timeLength: 1000*60*60*24*3, width: 200, disabled: false},
                {title: "100px : 1 місяць", timeLength: 1000*60*60*24*3, width: 100, disabled: false},
                {title: "80px : 1 місяць", timeLength: 1000*60*60*24*3, width: 80, disabled: false},
                {title: "50px : 1 місяць", timeLength: 1000*60*60*24*3, width: 50, disabled: false}
            ];
            this.TASK_NAME_PADDING_K = 10;  //відступ на 10px біля імені для кожного рівня вкладеності

            this.scaleIndex = null;	    //індекс обраного масштабу; let scale = app.scalesDictionary[app.scaleIndex];
            this.GCData = {             //дані про діаграму
                startDate: null,        //початкова дата всієї діаграми
                endDate: null,          //кінцева дата всієї діаграми
                minInterval: null,      //найкоротший інтервал задачі
                tasks: []               //модифікований масив задач що отримується з JSON
                                        // містить ще task[i].level - рівень вкладеності(кількість батьків) task[i].intervas[j].color
            };

            this.getData('/tasks.json')
                //.then( data => console.log('Gotten JSON with tasks: ', JSON.stringify(data)) )
                .then(this.validateModelData)
                .then(this.evaluateAppData)
                .then(this.renderGanttChart)
                .catch(this.renderError);

            this.setUpListeners();
        },

        setUpListeners() {
            //      this.form.addEventListener("submit", this.submitForm);
        },

        getData(jsonURL){
            return fetch(jsonURL)
                .then(checkStatus)
                .then(response => response.json() );

            function checkStatus(response) {
                if (response.status >= 200 && response.status < 300) {
                    return response;
                } else {
                    var error = new Error(response.statusText);
                    error.response = response;
                    throw error;
                }
            }
        },

        //рекурсивно обходить масив tasks та для кожного елемента викликає cb
        goThroughTasks(tasks, cb) {
            let index = 0;
            (function _goThroughTasks(tasks, cb, depth) {
                for(let task of tasks) {
                    ++index;
                    cb(task, index, depth);
                    if(task.subtasks && task.subtasks.length) {
                        goThroughTasks(task.subtasks, cb, depth+1);
                    }
                }
            }(tasks, cb, 0));
        },

        validateModelData(tasks) {
            //перевірити все
            if(!tasks )
                throw new Error("Не отримано списку задач при спробі перевірити їх на коректність. ");
            if(!(tasks instanceof Array))
                throw new Error("Отримано некоректну структуру даних із задачами: очікувався масив.");

            let arrOfUniqueId = [];
            app.goThroughTasks(tasks, (task, i) => {
                //перевіряємо на унікальність id
                if(arrOfUniqueId.includes(task.id))
                    throw new Error(`Отримано некоректну структуру даних із задачами: повторюється ідентифікатор задач id=${task.id}.`);
                arrOfUniqueId.push(task.id);

                //перевіряємо на коректність дати
                if(!task.intervals )
                    throw new Error(`Отримано некоректну структуру даних із задачами: задача з id=${task.id} не має списку початковиї і кінцевих дат.`);

                let invalidDate = task.intervals.some(taskDate => {
                        let sd = new Date(taskDate.startDate),
                            ed = new Date(taskDate.endDate);
                        return sd === 'Invalid Date' || ed === 'Invalid Date';
                    });
                if(invalidDate)
                    throw new Error(`Отримано некоректну структуру даних із задачами: задача з id=${task.id} має недопустиму дату.`);

                if(!task.intervals.length && !task.subtasks.length)
                    throw new Error(`Отримано некоректну структуру даних із задачами: для задачі з id=${task.id} має бути вказано не пустий список початкових і кінцевих дат, або не пустий список підзадач`);

                task.intervals.forEach(taskDate => {
                    if(new Date(taskDate.startDate) > new Date(taskDate.endDate))
                        throw new Error(`Отримано некоректну структуру даних із задачами: у задачі з id=${task.id} дата початку більша за дату кінця.`);
                });

                task.intervals.forEach(taskDate => {
                    if(new Date(taskDate.endDate) - new Date(taskDate.startDate) < 1000*60*60)
                        throw new Error(`Отримано некоректну структуру даних із задачами: у задачі з id=${task.id} вказано занадто короткий інтервал. Програма не підтримує задачі з тривалістю менше 1 години.`);
                });

                //ToDo: перевірити чи підзадачі не виходять за діапазон тривалості батьківської задачі
            });

            return tasks
        },

        //розраховує та встановлює дані про стан додатку
        evaluateAppData(tasks) {
            let minDate = new Date(1000*60*60*24*30*12*1000),
                maxDate = new Date(0),
                minInterval = Infinity;

            app.goThroughTasks(tasks, (task, i, depth) => {
                task.intervals.forEach(interval => {
                    if(minDate > interval.startDate)
                        minDate = interval.startDate;
                    if(maxDate < interval.endDate)
                        maxDate = interval.endDate;
                    let intervalLength = interval.endDate - interval.startDate;
                    if(intervalLength < minInterval)
                        minInterval = intervalLength;

                    interval.color = helpers.rndColor();   //задаємо колір полоски для кожного інтервалу
                });

                task.level = depth;     //запам'ятовуємо рівень відступу(який кратний кількості батьків) для кожної задачі
            });

            //вираховуємо оптимальний та допустимі масштаби
            this.scaleIndex = 0;
            this.scalesDictionary.reduce((best, current, i)=> {
                let rtwidth = ((maxDate - minDate)/current.timeLength)*current.width,     //яка буде ширина(px) правої таблиці при такому масштабі
                    k = rtwidth/app.GCBlock.clientWidth;
                //оптимальний масштаб
                if(0.5 < k < 3)
                    app.scaleIndex = i;
                //якщо це буде занадто малий масштаб, робимо його недоступним
                if(k < 0.5)
                    current.disabled = true;
            });

            this.GCData = {
                startDate: minDate,
                endDate: maxDate,
                minInterval,
                tasks
            };

            return this.GCData;
        },

        renderError(errorMsg){
            this.errorBlock.getElementsByClassName("error-block__msg")[0]
                .innerHTML("<strong> Сталася помилка <\/strong> <br>" + errorMsg.toString());
            this.settingsBlock.classList.add("hidden");
            this.GCBlock.classList.add("hidden");
            this.errorBlock.classList.remove("hidden");
        },

        renderGanttChart(data) {
            //заповнюємо select з масштабами
            let zoomOptionsHtmlStr = '';
            this.scalesDictionary.forEach((scale, i) => {
                let strSelected = (i === app.scaleIndex) ? 'selected="selected">' : '';
                let strDisabled = scale.disabled ? 'disabled="disabled">' : '';
                zoomOptionsHtmlStr += `<option value="${i}" ${strSelected} ${strDisabled}> ${scale.title} </option>`;
            });
            this.zoomSelectEl.innerHTML(zoomOptionsHtmlStr);

            //генеруємо масиви з частинами розмітки для діаграми
            let monthTitlesHTMLArr = [],
                dayTitlesHTMLArr = [],
                dayEmptyCellsHTMLArr = [],
                tmpDate = this.GCData.startDate,
                monthNames = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жоветнь', 'Листопад', 'Грудень'],
                thisMonth;
            do{
                dayTitlesHTMLArr.push(`<th class="GC-table__cell GC-table__h-cell GC-table--right__cell--day">${tmpDate.getDate()}</th>`);
                dayEmptyCellsHTMLArr.push(`<td class="GC-table__cell GC-table--right__cell--task-day"></td>`);

                if(thisMonth !== tmpDate.getMonth()){
                    thisMonth = tmpDate.getMonth();
                    monthHTMLArr.push(
                        `<th colspan="30" class="GC-table__cell GC-table__h-cell GC-table--right__cell--month">
                            ${monthNames[thisMonth] + ", " + tmpDate.getFullYear()}
                         </th>`
                    );
                }

                tmpDate.setDate(tmpDate.getDate()+1);   //збільшуємо день на 1
            }while(tmpDate <= this.GCData.endDate);

            let lTblBodyChildren = [],
                taskRowsHTML = [],
                fullIntervalL = app.endDate - app.startDate,
                scaleTimeLength = app.scalesDictionary[app.scaleIndex].timeLength,
                cellWidth = app.scalesDictionary[app.scaleIndex].width,
                numOfCells = fullIntervalL/scaleTimeLength;
            this.goThroughTasks(this.GCData.tasks, (task, i) => {
                let paddingLeft = task.level*this.TASK_NAME_PADDING_K;
                lTblBodyChildren.push(
                    `<tr class="GC-table__row GC-table--left__row">
                        <th class="GC-table__cell GC-table__h-cell GC-table--left__cell GC-table--left__cell--id"> ${task.id} </th>
                        <td class="GC-table__cell GC-table--left__cell GC-table--left__cell--task-name" style="padding-left:${paddingLeft}px">
                            ${task.taskName}
                        </td>
                    </tr>`
                );

                //створюємо DOM-елемент для рядка із задачею
                let taskRow = document.createElement("tr");
                taskRow.classList.add("GC-table__row GC-table--right__row GC-table--right__row--task");
                taskRow.innerHTML(dayEmptyCellsHTMLArr);

                //заповнюємо рядок із задачею
                task.intervals.forEach( (interval, i) => {
                    let sd = interval.startDate,
                        ed = interval.endDate,
                        intervalL = ed - sd,
                        width = intervalL/fullIntervalL*numOfCells*cellWidth,
                        left = sd/app.startDate*numOfCells*cellWidth;
                    taskRow.childNodes[i].innerHTML = `
                            <td class="GC-table__cell GC-table--right__cell--task-day">
                                <div class="GC-table--right__task-stripe" style="width:${width}px; top:${30*i+2}px; left:${left}px; background-color:${interval.color}"></div>
                            </td>
                    `;
                });

                taskRowsHTML.push(taskRow);
            });

            //Розмітка всієї діаграми
            let GCHTMLStr = `
                <div class="GC-table-wrapper">
                    <table class="GC-table GC-table--left">
                        <thead class="GC-table__head GC-table--left__head">
                            <tr class="GC-table__row GC-table--left__row GC-table--left__row--head-row">
                                <th class="GC-table__cell GC-table--left__cell GC-table--left__cell--fake" colspan="2"></th>
                            </tr>
                            <tr class="GC-table__row GC-table--left__row GC-table--left__row--head-row">
                                <th class="GC-table__cell GC-table__h-cell GC-table--left__cell"> ID </th>
                                <th class="GC-table__cell GC-table__h-cell GC-table--left__cell"> Назва задачі </th>
                            </tr>
                        </thead>
                        <tbody>
                            ${lTblBodyChildren.join()}
                        </tbody>
                    </table>
                </div>
                <div class="GC-table-wrapper table-responsive">
                    <table class="GC-table GC-table--right">
                        <thead class="GC-table__head GC-table--right__head">
                            <tr class="GC-table__row GC-table--right__row GC-table--right__row--month">
                                ${monthHTMLArr.join()}
                            </tr>
                            <tr class="GC-table__row GC-table--right__row GC-table--right__row--day">
                                ${dayTitlesHTMLArr.join()}
                            </tr>
                        </thead>
                        <tbody>
                            ${taskRowsHTML.join()}
                        </tbody>
                    </table>
                </div>`;

            this.GCBlock.dataset.scale = this.scaleIndex;

            //показуємо діаграму
            this.settingsBlock.classList.remove("hidden");
            this.GCBlock.classList.remove("hidden");
            this.errorBlock.classList.add("hidden");
        }
    };

    app.initialize();
}() );