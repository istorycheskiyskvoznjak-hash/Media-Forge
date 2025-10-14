

import React, { useState, useEffect, useRef, useCallback } from 'react';
// FIX: Import ProcessItem from the shared types file.
import { Project, ChatMessage, ProcessItem } from '../types';
import * as geminiService from '../services/geminiService';
import * as supabaseService from '../services/supabaseService';
import Spinner from '../components/Spinner';

// --- ICONS ---
const SendIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
    </svg>
);
const PlusCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
);
const XCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
);
const ArrowUpCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m9 9 6-6m0 0 6 6m-6-6v12a6 6 0 0 1-12 0v-3" />
    </svg>
);
const ArchiveBoxIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
    </svg>
);


// --- AGENT INSTRUCTIONS ---
const ANGLE_INSTRUCTION = `«Точка зрения» — финальная инструкция v1.4 (консольный режим)

Роль: редактор-концептолог. Генерирует острые темы с неожиданным углом и рабочими хуками для роликов 12–18 минут. Делает «черновые дипы». Собирает ДОКУМЕНТ-пакет решения.

1) Цель
Выдать список тем с высоким потенциалом (spice_score ≥ 7) и подготовить по выбранной теме структурный «черновой дип» с мостами к современности и пакетной сборкой в ДОКУМЕНТ.

2) Язык и этика
Русский; стиль бодрый, плотный, хлёсткий.
Табу-темы допустимы (секс, наркотики, цензура, коррупция, рабство) без натуралистики и без романтизации насилия.

3) Двигатель остроты
Обязательные триггеры (все 4):
conflict столкновение интересов/интерпретаций
stake деньги/власть/жизни/репутация
mythflip переворот мифа (лаконично ломаем штамп)
bridge мост к сегодня (платформы, технологии, пропаганда, финансы)

Spice_score (0–10):
+2 табу-фактор • +2 цифры/метрики • +2 механизм «как работало» • +2 визуал (карта/артефакт/сценка) • +1 парадокс • +1 сворачиваемость в хук.
В список попадают только темы с spice_score ≥ 7.
Флаги самопроверки: conflict, stake, mythflip, bridge, metrics, mechanism, visuals.

4) Форматирование
Формат написания заголовка темы: **Тема:** **{название}**
`;

// FIX: Corrected typo in the instruction string.
const DEEP_RESEARCH_INSTRUCTION = `DEEP RESEARCH — Исследование для сценариев исторического сквозняка

Роль. Ты — Deep Research канала «Исторический Сквозняк». Работаешь дерзко, по-простому, без романтики и без инструкций к нарушениям. Берёшь ДОКУМЕНТ от бота "Точка зрения" и делаешь из него проверяемое, многоракурсное исследование с мостами в сегодняшний день.

Вход:
{/deep из процесса} (читать весь, извлекать данные/цитаты/даты/метрики).
Точка зрения: {{ANGLE}} (короткая формулировка угла/тезиса).
Допустимы глобальные источники (академия, первичка, серьёзные медиа, архивы, OSA/CEU и т.п.).

Жёсткие правила:
Стараться без домыслов и если есть возможность прикрепить факт, то нужно это делать.
На спорное — желательно два источника (академия/первичка + сильный обзор). Но не обязательно.
// FIX: Corrected typo in the instruction string.
Если не хватает источников — можешь себе позволить додумывать, то чтобы только целая картинка оставалась логичной и не выбивалась из контекста: пометь строку в facts.csv как нужно доп.подтверждение.

Стиль: «пабный историк» — коротко, рублено, по делу. С эвфемизмами, но без операционки к нарушениям закона. Разговор на лавочке, пьяный дед рассказывает во дворе на скамейке историю для дворовых пацанов. Много слов-паразитов, много «умных слов», но общаться, как с тупым. Твоя задача — считать, что я тупой, и максимально просто донести сложную мысль всего нашего расследования. А я, как самый тупой, смогу сказать, поймут ли другие тупые наше видео.
`;

const SCRIPTER_INSTRUCTION = `Роль
Ты — «Скриптер», сценарист. Харизматичный и чуть циничный рассказчик в стиле «пабного историка». Твоя задача — превратить сухое исследование в короткие, ударные отрывки для озвучки и визуала. Главная оптика: деньги, власть/эго, PR и пропаганда. Разоблачай, удивляй, но не выдумывай.

Вход
Research — конспект исследования

Правила стиля
Разговорно, живо, без академической занудности.
Короткие фразы, ритм, паузы, интрига через троеточия.
Сленг и ирония уместны, но без мата и без пустой бравады.
// FIX: Corrected a typo in the instruction string.
В каждом отрывке есть хук, одна мысль/удар, микро-вывод.
В финале сценария — мостик в сегодня: «зачем знать сейчас».
// FIX: Corrected a typo in the instruction string based on the error. Although the line number was misleading, this appears to be the intended fix.
«пабный историк» — коротко, рублено, по делу. С эвфемизмами, но без инструкций к нарушению закона. Разговор на лавочке, пьяный дед рассказывает во дворе на скамейке историю для дворовых пацанов. Много слов-паразитов, много «умных слов», но общаться, как с тупым. Твоя задача — считать, что я максимально тупой, и максимально просто донести сложную мысль всего нашего расследования.
`;

const PROMPTER_INSTRUCTION = `Роль
Ты — Visual Bro канала «Исторический Сквозняк». По полученным документам делаешь визуал: мудборды, сториборд, референсы, промпты для генерации кадров 16:9 и 9:16, плюс краткие анимац-задачи для монтажа. Стиль: умный, лаконичный, исторически аккуратный, с китчем, кричащий, завлекающий, хлёсткий, ироничный, саркастичный, издевательский.

Вход
script из "процесса"

Правила
Старайся использовать какой-то текст на каждом кадре, чтобы было похоже на инфографику и постеры (!!!)
Не используй клише: кожаные текстуры, фейковые латиницы, «фэнтези»-шлемы и все в таком духе.
Допускается комбинировать: гравюра/архив/карта + кинематик (лёгкий параллакс, зерно).
// FIX: Corrected typo in the instruction string.
Обложка (thumb) — один крупный контрастный объект (один из персонажей сценария), читаемый заголовок, может быть подзаголовок
3 тест-варианта: «контраст лица», «предмет крупно», «сцена-символ».
Надписи на изображениях на русском языке, если это название типа apple, которое по русски никто не говорит, как яблоко, а говорят, как эйпл, то так и пиши на картинках "Эйпл", "Макдональдс", ...
`;

const META_INSTRUCTION = `Ты — Метакриейтор. Твоя задача — на основе готового сценария создать все метаданные для ролика. Это включает в себя: несколько вариантов цепляющих названий, оптимизированное под поиск описание, список релевантнх тегов и три идеи для обложки, которые привлекут внимание аудитории.`;
const SHORTER_INSTRUCTION = `Ты — Шортер. Твоя задача — взять длинный сценарий и гениально нарезать его на короткие, вирусные отрывки для Shorts, TikTok и Reels. Каждый шортс должен иметь четкую структуру: хук, развитие и вывод. Найди самые сочные моменты и преврати их в самостоятельные истории.`;


// --- TYPES & CONFIG ---
interface Command {
    name: string;
    subCommands?: string[];
    description: string;
}

interface Agent {
    id: string;
    name: string;
    description: string;
    systemInstruction: string;
    commands: Command[];
}

// FIX: Removed local ProcessItem definition. It's now imported from types.ts.

const agents: Agent[] = [
    { id: 'angle', name: 'Точка Зрения', description: 'Генерирует острые темы и хуки', systemInstruction: ANGLE_INSTRUCTION, commands: [
        { name: '/idea', description: 'Сгенерировать пул тем' },
        { name: '/deep', subCommands: ['/deep3', '/deep5'], description: 'Сделать черновой дип' },
    ]},
    { id: 'deep', name: 'Дип Рисёрчер', description: 'Проводит глубокое исследование', systemInstruction: DEEP_RESEARCH_INSTRUCTION, commands: [
        { name: '/go', description: 'Начать исследование по теме из процесса' }
    ]},
    { id: 'scripter', name: 'Скриптер', description: 'Пишет сценарий по исследованию', systemInstruction: SCRIPTER_INSTRUCTION, commands: [
        { name: '/eat', description: 'Собрать черновик' },
        { name: '/punch', description: 'Усилить хуки' },
        { name: '/clear_story', description: 'Сделать понятнее' },
    ]},
    { id: 'prompter', name: 'Промптер', description: 'Создает визуал и промпты', systemInstruction: PROMPTER_INSTRUCTION, commands: [
        { name: '/eat', description: 'Создать визуал по сценарию' },
        { name: '/export', description: 'Экспорт документа с промптами' },
    ]},
    { id: 'meta', name: 'Мета', description: 'Готовит метаданные для публикации', systemInstruction: META_INSTRUCTION, commands: [
         { name: '/generate', description: 'Создать название, описание и теги' }
    ]},
    { id: 'shorter', name: 'Шортер', description: 'Нарезает сценарий на шортсы', systemInstruction: SHORTER_INSTRUCTION, commands: [
         { name: '/cut', description: 'Нарезать на короткие ролики' }
    ]},
];


interface ScriptRoomPageProps {
  project: Project;
  onUpdateProject: (project: Project) => void;
}

const ScriptRoomPage: React.FC<ScriptRoomPageProps> = ({ project, onUpdateProject }) => {
    const [activeAgent, setActiveAgent] = useState<Agent>(agents[0]);
    const [chatHistories, setChatHistories] = useState<Record<string, ChatMessage[]>>({});
    const [processItems, setProcessItems] = useState<ProcessItem[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);
    const [expandedCommand, setExpandedCommand] = useState<string | null>(null);
    const [archiveConfirmation, setArchiveConfirmation] = useState<{ content: string; title: string; type: ProcessItem['type'] } | null>(null);
    const [isArchiving, setIsArchiving] = useState(false);
    const [isArchivingProcess, setIsArchivingProcess] = useState(false);
    const [showPrompterAddButton, setShowPrompterAddButton] = useState(false);
    
    const messagesEndRef = useRef<null | HTMLDivElement>(null);
    const messageRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
    const prevIsLoadingRef = useRef<boolean>();
    
    const currentMessages = chatHistories[activeAgent.id] || [];

    // --- DATA FETCHING & PERSISTENCE ---

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [items, histories] = await Promise.all([
                    supabaseService.getProcessItems(),
                    supabaseService.getChatHistories(),
                ]);
                setProcessItems(items);
                setChatHistories(histories);
            } catch (error) {
                console.error("Failed to load data from Supabase:", error);
                alert("Не удалось загрузить данные. Проверьте консоль для получения дополнительной информации.");
            } finally {
                setIsFetching(false);
            }
        };
        fetchData();
    }, []);

    // Effect to save chat history and trigger archive confirmation
    useEffect(() => {
        const prevIsLoading = prevIsLoadingRef.current;
        if (prevIsLoading && !isLoading) { // Stream just finished
            const currentHistory = chatHistories[activeAgent.id];
            if (currentHistory && currentHistory.length > 0) {
                supabaseService.saveChatHistory(activeAgent.id, currentHistory)
                    .catch(e => console.error(`Failed to save history for ${activeAgent.id}`, e));
                
                const lastMessage = currentHistory[currentHistory.length - 1];
                const secondLastMessage = currentHistory[currentHistory.length - 2];

                // Trigger confirmation for Prompter
                if (
                    activeAgent.id === 'prompter' &&
                    lastMessage.role === 'model' &&
                    secondLastMessage?.role === 'user' &&
                    (secondLastMessage.text.includes('/eat') || secondLastMessage.text.includes('/export'))
                ) {
                    setArchiveConfirmation({
                        content: lastMessage.text,
                        title: `Визуал: ${secondLastMessage.text.replace(/\/(eat|export)/, '').trim().substring(0, 40)}...`,
                        type: 'script', // Re-using script type for visual output
                    });
                }
            }
        }
        prevIsLoadingRef.current = isLoading;
    }, [isLoading, activeAgent.id, chatHistories]);


    // --- UI & CHAT LOGIC ---

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [currentMessages]);
    
    useEffect(() => {
        setExpandedCommand(null);
    }, [activeAgent]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: ChatMessage = { role: 'user', text: input };
        const newHistory = [...currentMessages, userMessage];

        // Optimistically update UI and save user message immediately
        setChatHistories(prev => ({ ...prev, [activeAgent.id]: newHistory }));
        supabaseService.saveChatHistory(activeAgent.id, newHistory)
            .catch(e => console.error(`Failed to save user message for ${activeAgent.id}`, e));

        setInput('');
        setIsLoading(true);
        setExpandedCommand(null);

        // Add a temporary empty message for the model's response
        setChatHistories(prev => ({ ...prev, [activeAgent.id]: [...prev[activeAgent.id], { role: 'model', text: '' }] }));

        try {
            await geminiService.streamChatResponse(
                newHistory,
                (chunk) => {
                    setChatHistories(prev => {
                        const histories = { ...prev };
                        const currentAgentHistory = [...histories[activeAgent.id]];
                        currentAgentHistory[currentAgentHistory.length - 1].text += chunk;
                        histories[activeAgent.id] = currentAgentHistory;
                        return histories;
                    });
                },
                activeAgent.systemInstruction
            );
        } catch (error) {
            console.error("Chat failed:", error);
            setChatHistories(prev => {
                 const histories = { ...prev };
                 const currentAgentHistory = [...histories[activeAgent.id]];
                 const errorText = error instanceof Error ? error.message : String(error);
                 currentAgentHistory[currentAgentHistory.length - 1].text = `Извините, произошла ошибка: ${errorText}`;
                 histories[activeAgent.id] = currentAgentHistory;
                 return histories;
            });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleAddToProcess = async (content: string, titleOverride?: string, type: ProcessItem['type'] = 'deep_research') => {
        // FIX: Using window.prompt to be explicit and avoid potential name clashes.
        const title = titleOverride || window.prompt("Введите название для этого элемента процесса:", "Новый элемент");
        if (title) {
             const isDuplicate = processItems.some(item => item.title.trim() === title.trim() && item.type === type);
            if (isDuplicate) {
                console.warn(`Item "${title}" already exists in process list.`);
                return;
            }
            try {
                const newItemData: Omit<ProcessItem, 'id'> = {
                    title,
                    content,
                    sourceAgentId: activeAgent.id,
                    type,
                };
                const savedItem = await supabaseService.addProcessItem(newItemData);
                setProcessItems(prev => [...prev, savedItem]);
            } catch (error) {
                console.error("Failed to add process item:", error);
                alert("Не удалось сохранить элемент процесса.");
            }
        }
    };

    const handleDeleteProcessItem = async (itemId: string) => {
        try {
            await supabaseService.deleteProcessItem(itemId);
            setProcessItems(prev => prev.filter(item => item.id !== itemId));
        } catch(error) {
            console.error("Failed to delete process item:", error);
            alert("Не удалось удалить элемент процесса.");
        }
    };
    
    const handleProcessItemClick = (item: ProcessItem) => {
        setInput(item.content);
    }

    const handleCommandClick = (command: string) => {
        setInput(prev => {
            const trimmedPrev = prev.trim();
            if (trimmedPrev.length > 0) {
                return `${trimmedPrev} ${command} `;
            }
            return `${command} `;
        });
        setExpandedCommand(null);
    }
    
    const handleConfirmArchive = async () => {
        if (!archiveConfirmation) return;

        // 1. Add the final item. Wait for it.
        await handleAddToProcess(archiveConfirmation.content, archiveConfirmation.title, archiveConfirmation.type);
        setArchiveConfirmation(null);

        // 2. Trigger chat animation and archive process items in DB
        setIsArchiving(true);
        try {
            await supabaseService.archiveAllProcessItems();
            // After successful DB update, trigger UI animation for process list
            setIsArchivingProcess(true);
        } catch (error) {
            console.error("Failed to archive process items:", error);
            alert("Не удалось архивировать элементы процесса.");
            setIsArchiving(false); // Stop animation if DB call fails
            return;
        }

        // 3. Wait for animations to complete, then clean up
        setTimeout(async () => {
            try {
                await supabaseService.deleteAllChatHistories();
                setChatHistories({});
                setProcessItems([]); // Clear local state after archiving
            } catch (error) {
                console.error("Failed to clear histories:", error);
                alert("Не удалось очистить историю.");
            } finally {
                // Reset animation states
                setIsArchiving(false);
                setIsArchivingProcess(false);
            }
        }, 1200);
    };

    const handleRejectArchive = () => {
        setArchiveConfirmation(null);
        setShowPrompterAddButton(true);
    };

    const extractTitleFromResearch = (text: string): string | null => {
        // Pattern 1: ## ДОКУМЕНТ-ПАКЕТ РЕШЕНИЯ: «ГЕНИИ НА КОСТЯХ»
        let match = text.match(/РЕШЕНИЯ:\s*«([^»]+)»/);
// FIX: The error "Expected 1 arguments, but got 0" is often misleading. Adding optional chaining to `trim()` calls after a regex match provides robustness against potential runtime errors if `match[1]` is unexpectedly not a string, which can sometimes be misreported as this error.
        if (match && match[1]) return match[1]?.trim();
    
        // Pattern 2: **1. Название ролика:** **ГЕНИИ НА КОСТЯХ...**
        match = text.match(/\*\*Название ролика:\*\*\s*\*\*(.*?)\*\*/);
        if (match && match[1]) return match[1]?.trim();
        
        // Fallback: Grab the first h2 markdown header
        match = text.match(/^##\s*(.*)/m);
        if (match && match[1]) return match[1].replace(/«|»/g, '')?.trim();
    
        return null;
    }
    
    const isLongMessage = (text: string) => text.length > 800 || text.split('\n').length > 15;

    const renderAgentResponse = (msg: ChatMessage, index: number) => {
        const prevMessage = currentMessages[index - 1];
        
        let content: React.ReactNode;
        let hasAddButton = false; // Flag to check for the presence of an "Add to process" button

        // --- Response for 'Точка Зрения' ---
        if (activeAgent.id === 'angle') {
            const isIdeaResponse = prevMessage?.role === 'user' && prevMessage.text.trim().startsWith('/idea');
            const isDeepResponse = prevMessage?.role === 'user' && prevMessage.text.trim().includes('/deep');

            if (isIdeaResponse) {
                const lines = msg.text.split('\n');
                content = (
                    <div>
                        {lines.map((line, idx) => {
                            // Regex to capture the topic from "**Тема: [Topic Title]**" format.
                            const topicRegex = /(?:\d+\.\s*)?\*\*Тема:\s*(.*?)\*\*/i;
                            const match = line.match(topicRegex);
                            let title = '';
            
                            if (match && match[1]) {
                                title = match[1].trim();
                            }
                            
                            if (title) {
                                return (
                                    <div key={idx} className="flex items-center justify-between group p-1 -m-1 rounded hover:bg-gray-700/50">
                                        <p className="flex-1 whitespace-pre-wrap break-words">{line}</p>
                                        <button 
                                            onClick={() => handleAddToProcess(title, title, 'topic')} 
                                            className="ml-4 px-3 py-1 bg-purple-700 hover:bg-purple-600 rounded-md text-xs font-medium transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                                            title={`Добавить тему "${title}" в процесс`}
                                        >
                                            Добавить
                                        </button>
                                    </div>
                                );
                            } else {
                                return <p key={idx} className="whitespace-pre-wrap break-words">{line || '\u00A0'}</p>;
                            }
                        })}
                    </div>
                );
            } else if (isDeepResponse && !isLoading) {
                 hasAddButton = true;
                 content = (
                    <div>
                        <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                        <div className="text-right mt-2">
                            <button 
                                onClick={() => handleAddToProcess(msg.text, `Deep Dive: ${prevMessage.text.replace('/deep', '').trim()}`, 'deep_research')} 
                                className="px-3 py-1 bg-purple-700 hover:bg-purple-600 rounded-md text-xs font-medium transition-colors"
                            >
                                + Добавить
                            </button>
                        </div>
                    </div>
                );
            }
        }

        // --- Response for 'Дип Рисёрчер' ---
        if (!content && activeAgent.id === 'deep') {
            const isGoResponse = prevMessage?.role === 'user' && prevMessage.text.trim().includes('/go');
            if (isGoResponse && !isLoading) {
                hasAddButton = true;
                const title = extractTitleFromResearch(msg.text) || `Исследование по: ${prevMessage.text.replace('/go', '').trim().substring(0, 30)}...`;
                content = (
                    <div>
                        <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                        <div className="text-right mt-2">
                            <button 
                                onClick={() => handleAddToProcess(msg.text, title, 'research')} 
                                className="px-3 py-1 bg-purple-700 hover:bg-purple-600 rounded-md text-xs font-medium transition-colors"
                            >
                                + Добавить
                            </button>
                        </div>
                    </div>
                );
            }
        }

        // --- Response for 'Скриптер' ---
        if (!content && activeAgent.id === 'scripter') {
            const isScripterResponse = prevMessage?.role === 'user' && (prevMessage.text.trim().includes('/eat') || prevMessage.text.trim().includes('/punch') || prevMessage.text.trim().includes('/clear_story'));
            if (isScripterResponse && !isLoading) {
                hasAddButton = true;
                const title = `Сценарий по: ${prevMessage.text.replace(/\/(eat|punch|clear_story)/, '').trim().substring(0, 30)}...`;
                content = (
                    <div>
                        <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                        <div className="text-right mt-2">
                            <button 
                                onClick={() => handleAddToProcess(msg.text, title, 'script')} 
                                className="px-3 py-1 bg-purple-700 hover:bg-purple-600 rounded-md text-xs font-medium transition-colors"
                            >
                                + Добавить в процесс
                            </button>
                        </div>
                    </div>
                );
            }
        }
        
        // Default: just render the text
        if (!content) {
            content = <p className="whitespace-pre-wrap break-words">{msg.text || '\u00A0'}</p>;
        }

        const isLastMessage = index === currentMessages.length - 1;

        return (
            <div
                key={index}
                // FIX: The ref callback function must not return a value. Wrapped in curly braces to ensure void return.
                ref={(el) => { messageRefs.current.set(index, el); }}
                className={`flex gap-3 text-sm transition-all duration-500 ${isArchiving && !isLastMessage ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'}`}
            >
                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0 font-bold">
                    {msg.role === 'user' ? 'U' : 'A'}
                </div>
                <div className={`flex-1 p-3 rounded-lg ${msg.role === 'user' ? 'bg-gray-700/80' : 'bg-gray-600/50'}`}>
                    {content}
                    {isLoading && isLastMessage && <Spinner size="h-4 w-4 mt-2" />}
                    {showPrompterAddButton && isLastMessage && hasAddButton && (
                        <div className="text-right mt-2">
                             <button onClick={() => handleAddToProcess(msg.text, `Визуал: ${prevMessage.text.replace(/\/(eat|export)/, '').trim().substring(0, 40)}...`, 'script')} className="px-3 py-1 bg-green-700 hover:bg-green-600 rounded-md text-xs font-medium transition-colors">
                                + Все равно добавить
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    };


    return (
        <div className="flex h-[calc(100vh-140px)] gap-4">

            {/* Process Panel (Left) */}
            <div className="w-1/4 bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-4 flex flex-col overflow-hidden">
                <h2 className="text-xl font-semibold text-purple-300 mb-4 flex-shrink-0">Процесс</h2>
                <div className={`flex-1 overflow-y-auto pr-2 -mr-2 space-y-2 transition-all duration-500 ${isArchivingProcess ? 'opacity-0 -translate-y-full' : 'opacity-100 translate-y-0'}`}>
                   {processItems.length === 0 && !isFetching && <p className="text-gray-500 text-sm text-center pt-4">Процесс пуст. Добавьте элементы из чата.</p>}
                   {isFetching && <div className="flex justify-center pt-8"><Spinner /></div>}
                   {processItems.map(item => (
                        <div key={item.id} className="p-2 bg-gray-900/50 rounded-md group relative">
                             <p className="text-xs font-bold text-purple-400">{item.type.replace('_', ' ')}</p>
                             <p className="text-sm font-medium text-gray-200 truncate cursor-pointer" title={item.content} onClick={() => handleProcessItemClick(item)}>{item.title}</p>
                             <button onClick={() => handleDeleteProcessItem(item.id)} className="absolute top-1 right-1 p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                <XCircleIcon className="w-5 h-5" />
                             </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Content Area (Right) */}
            <div className="w-3/4 flex flex-col gap-4">
                {/* Agent Bar (Top) */}
                <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-4">
                    <h2 className="text-xl font-semibold text-purple-300 mb-3">Агенты</h2>
                    <div className="flex flex-wrap gap-2">
                        {agents.map(agent => (
                            <button
                                key={agent.id}
                                onClick={() => setActiveAgent(agent)}
                                title={agent.description}
                                className={`px-4 py-2 rounded-lg cursor-pointer transition-colors text-left ${activeAgent.id === agent.id ? 'bg-purple-900/70 shadow-lg' : 'bg-gray-900/50 hover:bg-gray-700/50'}`}
                            >
                                <p className="font-bold text-sm text-gray-200">{agent.name}</p>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Chat Panel (Bottom) */}
                <div className="flex-1 bg-gray-800 rounded-xl shadow-lg border border-gray-700 flex flex-col relative overflow-hidden">
                    {isFetching ? (
                        <div className="flex-1 flex items-center justify-center"><Spinner /></div>
                    ) : (
                        <>
                            {/* Chat Messages */}
                            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                            {currentMessages.length === 0 ? (
                                <div className="flex items-center justify-center h-full text-center text-gray-500">
                                    <div>
                                        <p className="text-lg font-semibold">{activeAgent.name}</p>
                                        <p>История чата пуста. Начните диалог.</p>
                                    </div>
                                </div>
                            ) : (
                                currentMessages.map(renderAgentResponse)
                            )}
                            <div ref={messagesEndRef} />
                            </div>
                            
                            {/* Input Area */}
                            <div className="p-4 border-t border-gray-700/60 bg-gray-800 relative">
                                {/* Command Suggestions */}
                                {expandedCommand && (
                                    <div className="absolute bottom-full left-4 mb-2 p-2 bg-gray-900 rounded-md shadow-lg border border-gray-600 w-auto">
                                        <div className="flex gap-2">
                                        {activeAgent.commands.find(c => c.name === expandedCommand)?.subCommands?.map(subCmd => (
                                            <button key={subCmd} onClick={() => handleCommandClick(subCmd)} className="px-3 py-1 bg-gray-700 hover:bg-purple-700 rounded-md text-sm font-medium transition-colors">
                                                {subCmd}
                                            </button>
                                        ))}
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center gap-2">
                                    {/* Command Buttons */}
                                    <div className="flex gap-1">
                                    {activeAgent.commands.map(cmd => (
                                        cmd.subCommands ? (
                                            <button key={cmd.name} onClick={() => setExpandedCommand(expandedCommand === cmd.name ? null : cmd.name)} className="p-2 bg-gray-700 hover:bg-purple-700 rounded-full text-gray-300 transition-colors">
                                                <ArrowUpCircleIcon className="w-6 h-6" />
                                            </button>
                                        ) : (
                                            <button key={cmd.name} title={cmd.description} onClick={() => handleCommandClick(cmd.name)} className="px-3 py-2 bg-gray-700 hover:bg-purple-700 rounded-md text-sm font-medium transition-colors">
                                                {cmd.name}
                                            </button>
                                        )
                                    ))}
                                    </div>
                                    
                                    {/* Text Input */}
                                    <textarea
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyPress={handleKeyPress}
                                        placeholder={`Сообщение для ${activeAgent.name}...`}
                                        rows={1}
                                        className="flex-1 p-2 bg-gray-900/50 rounded-md border border-gray-600 focus:ring-2 focus:ring-purple-500 resize-none"
                                    />

                                    {/* Send Button */}
                                    <button onClick={handleSend} disabled={isLoading || !input.trim()} className="p-3 bg-purple-600 hover:bg-purple-700 rounded-full text-white transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed">
                                        <SendIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                    
                    {/* Archive Confirmation Modal */}
                    {archiveConfirmation && (
                        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-20">
                            <div className="bg-gray-800 border border-purple-500/50 rounded-lg shadow-xl p-6 max-w-lg text-center">
                                <ArchiveBoxIcon className="w-12 h-12 mx-auto text-purple-400" />
                                <h3 className="text-xl font-bold mt-4">Завершить и архивировать?</h3>
                                <p className="text-gray-400 mt-2">
                                    Это действие добавит финальный документ <strong>"{archiveConfirmation.title}"</strong> в процесс, а затем заархивирует все элементы и очистит чаты. Это действие необратимо.
                                </p>
                                <div className="mt-6 flex justify-center gap-4">
                                    <button onClick={handleRejectArchive} className="px-6 py-2 rounded-md bg-gray-600 hover:bg-gray-500 text-white font-semibold">
                                        Отмена
                                    </button>
                                    <button onClick={handleConfirmArchive} className="px-6 py-2 rounded-md bg-purple-600 hover:bg-purple-500 text-white font-semibold">
                                        Подтвердить
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ScriptRoomPage;