exports.prettyLog = (service, requests, sportCode, description, gameCount) => {
    const timestamp = new Date().toLocaleString().padEnd(22);
    service = service.padEnd(12);
    requests = String(requests).padStart(4);
    sportCode = sportCode.padEnd(20);
    description = description.padEnd(60);
    gameCount = String(gameCount).padStart(3);

    return `${timestamp} │ ${service} │ ${requests} │ ${sportCode} │ ${description} │ ${gameCount}`;
}