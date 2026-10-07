#include "rodent.h"
#include <emscripten/emscripten.h>
#include <cstring>
#include <cstdlib>

static POS position;

extern "C" {
EMSCRIPTEN_KEEPALIVE void rodent_init() {
    srand(1);
    BB.Init();
    cEngine::InitSearch();
    POS::Init();
    Glob.Init();
    Par.elo = 2800;
    Par.SetSpeed(Par.elo);
    Par.InitKingAttackTable();
    Mask.Init();
    Dist.Init();
    Par.DefaultWeights();
    Par.chess960 = false;
    Par.useBook = false;
    Par.use_ponder = false;
    Glob.usePersonalityFiles = false;
    Trans.AllocTrans(8);
    position.SetPosition(START_POS);
    PrintVersion();
}

EMSCRIPTEN_KEEPALIVE void rodent_command(const char *command) {
    char token[80];
    const char *arguments = ParseToken(command, token);
    if (!strcmp(token, "position")) position.ParsePosition(arguments);
    else if (!strcmp(token, "go")) ParseGo(&position, arguments);
    else if (!strcmp(token, "setoption")) ParseSetoption(arguments);
    else if (!strcmp(token, "isready")) printfUciOut("readyok\n");
    else if (!strcmp(token, "ucinewgame")) { Trans.Clear(); Glob.ClearData(); }
}
}
