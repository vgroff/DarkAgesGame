
export const successText = "success";
export const failureText = "failure";
export const majorSuccessText = "major success";
export const majorFailureText = "major failure";
export const defaultMajorModifier = 0.33;

export function rollSuccess(successChance, majorModifier=defaultMajorModifier) {
    let roll = Math.random();
    if (roll < successChance) {
        if (roll < successChance*majorModifier) {
            return majorSuccessText
        } else {
            return successText
        }
    } else {
        let overlap = roll - successChance;
        let majorFailureChance = (1 - successChance)*majorModifier;
        if (overlap < majorFailureChance) {
            return majorFailureText
        } else {
            return failureText
        }
    }
}

export function getProbabilities(successChance, majorModifier=defaultMajorModifier) {
    successChance = Math.min(1, Math.max(0, successChance));
    return {
        successText: successChance * (1-majorModifier),
        majorSuccessText: successChance * majorModifier,
        failureText: (1 - successChance) * (1-majorModifier),
        majorFailureText: (1 - successChance) * majorModifier,    
    }
}

export function successToNumber(successFailure, majorModifier=0.5) { // majorModifier=2 for linear behaviour
    if (successFailure === successText) {
        return 1;
    } else if (successFailure === majorSuccessText) {
        return 1+majorModifier;
    } else if (successFailure === failureText) {
        return -1;
    } else if (successFailure === majorFailureText) {
        return -1-majorModifier;
    } else {
        throw Error("what")
    }
}

export function successToQualityText(successFailure) {
    if (successFailure === successText) {
        return 'good';
    } else if (successFailure === majorSuccessText) {
        return 'great';
    } else if (successFailure === failureText) {
        return 'poor';
    } else if (successFailure === majorFailureText) {
        return 'very poor';
    } else {
        throw Error("what")
    }
}

export function successToTruthy(successFailure) {
    if (successFailure === successText) {
        return true;
    } else if (successFailure === majorSuccessText) {
        return true;
    } else if (successFailure === failureText) {
        return false;
    } else if (successFailure === majorFailureText) {
        return false;
    } else {
        throw Error("what")
    }
}