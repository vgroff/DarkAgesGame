export const spring = 'spring';
export const summer = 'summer';
export const autumn = 'autumn';
export const winter = 'winter';
export const seasons = [spring, summer, autumn, winter];
export const daysInYear = 80;


export function seasonToTempFactor(season) {
    if (season === spring || season === autumn) {
        return 0;
    } else if (season === summer) {
        return 1;
    } else if (season === winter) {
        return -1;
    } else {
        throw Error("not a season")
    }
}